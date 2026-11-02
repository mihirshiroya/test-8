//! Lifecycle of the bundled Go backend (a Tauri sidecar).
//!
//! - One backend process per app instance, bound to 127.0.0.1 on a port picked
//!   at launch and kept for restarts so the webview origin and cookies stay valid.
//! - Secrets go over stdin; when this process dies the pipe closes and the
//!   backend shuts itself down, so it can never be orphaned.
//! - An unexpected exit is restarted automatically a few times and the
//!   webviews are told to reconnect.

use std::{
    net::TcpListener,
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

use crate::{secrets, AppState};

const SIDECAR: &str = "productivity-backend";
const PREFERRED_PORT: u16 = 47831;
const READY_TIMEOUT: Duration = Duration::from_secs(60);
const STOP_TIMEOUT: Duration = Duration::from_secs(8);
const MAX_CRASH_RESTARTS: u32 = 3;
const TOKEN_HEADER: &str = "X-Desktop-Token";

pub const EVENT_RESTARTED: &str = "desktop://backend-restarted";
pub const EVENT_EXITED: &str = "desktop://backend-exited";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendStatus {
    pub ready: bool,
    pub starting: bool,
    pub error: Option<String>,
    pub origin: String,
}

struct Inner {
    child: Option<CommandChild>,
    generation: u64,
    exited: Arc<AtomicBool>,
    error: Option<String>,
}

pub struct Backend {
    port: u16,
    token: String,
    inner: Mutex<Inner>,
    /// Serialises start/stop so two restarts can never run concurrently.
    lifecycle: Mutex<()>,
    ready: AtomicBool,
    starting: AtomicBool,
    crash_restarts: AtomicU32,
}

impl Backend {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            port: pick_port()?,
            token: secrets::random_token(48),
            inner: Mutex::new(Inner {
                child: None,
                generation: 0,
                exited: Arc::new(AtomicBool::new(true)),
                error: None,
            }),
            lifecycle: Mutex::new(()),
            ready: AtomicBool::new(false),
            starting: AtomicBool::new(false),
            crash_restarts: AtomicU32::new(0),
        })
    }

    pub fn origin(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// First URL a webview loads: exchanges the launch token for an HttpOnly
    /// session cookie, then redirects to `next`.
    pub fn bootstrap_url(&self, next: &str) -> Result<tauri::Url, String> {
        let mut url: tauri::Url = format!("{}/__desktop/bootstrap", self.origin())
            .parse()
            .map_err(|e| format!("invalid backend URL: {e}"))?;
        url.query_pairs_mut().append_pair("token", &self.token).append_pair("next", next);
        Ok(url)
    }

    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }

    pub fn status(&self) -> BackendStatus {
        BackendStatus {
            ready: self.is_ready(),
            starting: self.starting.load(Ordering::SeqCst),
            error: self.inner.lock().unwrap().error.clone(),
            origin: self.origin(),
        }
    }

    /// Starts (or restarts) the backend and blocks until it answers.
    pub fn start(&self, app: &AppHandle) -> Result<(), String> {
        let _guard = self.lifecycle.lock().unwrap();
        self.starting.store(true, Ordering::SeqCst);
        let result = self.start_locked(app);
        self.starting.store(false, Ordering::SeqCst);
        let mut inner = self.inner.lock().unwrap();
        inner.error = result.as_ref().err().cloned();
        if let Err(e) = &result {
            log::error!("backend failed to start: {e}");
        }
        result
    }

    fn start_locked(&self, app: &AppHandle) -> Result<(), String> {
        self.stop_locked();

        let secrets_line = secrets::backend_secrets_line(&self.token)?;
        let frontend_dir = app
            .path()
            .resolve("frontend", BaseDirectory::Resource)
            .map_err(|e| format!("Could not locate the bundled frontend: {e}"))?;
        let origin = self.origin();

        let envs: Vec<(String, String)> = vec![
            ("DESKTOP_MODE".into(), "true".into()),
            ("DESKTOP_SECRETS_STDIN".into(), "true".into()),
            ("PORT".into(), self.port.to_string()),
            ("FRONTEND_DIR".into(), frontend_dir.to_string_lossy().into_owned()),
            ("NODE_ENV".into(), "desktop".into()),
            ("APP_NAME".into(), "Notch Buddy".into()),
            ("CLIENT_URL".into(), origin.clone()),
            ("SERVER_URL".into(), origin),
            ("AUTO_MIGRATE".into(), "true".into()),
            ("DB_MAX_CONNS".into(), "8".into()),
        ];

        let (mut rx, mut child) = app
            .shell()
            .sidecar(SIDECAR)
            .map_err(|e| format!("The backend binary is missing from this installation: {e}"))?
            .envs(envs)
            .spawn()
            .map_err(|e| format!("Could not start the local backend: {e}"))?;

        if let Err(e) = child.write(secrets_line.as_bytes()) {
            let _ = child.kill();
            return Err(format!("Could not hand credentials to the backend: {e}"));
        }

        let exited = Arc::new(AtomicBool::new(false));
        let generation = {
            let mut inner = self.inner.lock().unwrap();
            inner.generation += 1;
            inner.child = Some(child);
            inner.exited = exited.clone();
            inner.generation
        };

        let handle = app.clone();
        let exited_flag = exited.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        log::info!(target: "backend", "{}", String::from_utf8_lossy(&line).trim_end())
                    }
                    CommandEvent::Stderr(line) => {
                        log::warn!(target: "backend", "{}", String::from_utf8_lossy(&line).trim_end())
                    }
                    CommandEvent::Error(e) => log::error!(target: "backend", "{e}"),
                    CommandEvent::Terminated(payload) => {
                        exited_flag.store(true, Ordering::SeqCst);
                        log::warn!("backend exited with code {:?}", payload.code);
                        on_terminated(&handle, generation);
                        break;
                    }
                    _ => {}
                }
            }
        });

        self.wait_ready(&exited)?;
        self.ready.store(true, Ordering::SeqCst);
        log::info!("backend ready on {}", self.origin());
        Ok(())
    }

    fn wait_ready(&self, exited: &AtomicBool) -> Result<(), String> {
        let url = format!("{}/__desktop/status", self.origin());
        let deadline = Instant::now() + READY_TIMEOUT;
        while Instant::now() < deadline {
            if exited.load(Ordering::SeqCst) {
                return Err("The local backend stopped during startup. Open the log folder from Desktop settings for details.".into());
            }
            let response = ureq::get(&url)
                .set(TOKEN_HEADER, &self.token)
                .timeout(Duration::from_secs(2))
                .call();
            if matches!(response, Ok(r) if r.status() == 200) {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(200));
        }
        Err("The local backend did not become ready in time.".into())
    }

    /// Graceful stop: ask the backend to drain, then kill it if it lingers.
    pub fn stop(&self) {
        let _guard = self.lifecycle.lock().unwrap();
        self.stop_locked();
    }

    fn stop_locked(&self) {
        self.ready.store(false, Ordering::SeqCst);
        let (child, exited) = {
            let mut inner = self.inner.lock().unwrap();
            // Bumping the generation marks the coming exit as intentional.
            inner.generation += 1;
            (inner.child.take(), inner.exited.clone())
        };
        let Some(child) = child else { return };

        let _ = ureq::post(&format!("{}/__desktop/shutdown", self.origin()))
            .set(TOKEN_HEADER, &self.token)
            .timeout(Duration::from_secs(2))
            .send_string("");

        let deadline = Instant::now() + STOP_TIMEOUT;
        while !exited.load(Ordering::SeqCst) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(100));
        }
        if !exited.load(Ordering::SeqCst) {
            log::warn!("backend did not stop in time, killing it");
            let _ = child.kill();
        }
    }

    fn is_current(&self, generation: u64) -> bool {
        let inner = self.inner.lock().unwrap();
        inner.generation == generation && inner.child.is_some()
    }

    fn clear_crashed(&self) {
        self.ready.store(false, Ordering::SeqCst);
        self.inner.lock().unwrap().child = None;
    }
}

/// Restarts a backend that exited on its own (crash, killed by the user).
fn on_terminated(app: &AppHandle, generation: u64) {
    let state = app.state::<AppState>();
    if !state.backend.is_current(generation) || state.is_quitting() {
        return;
    }
    state.backend.clear_crashed();
    let _ = app.emit(EVENT_EXITED, ());

    let attempt = state.backend.crash_restarts.fetch_add(1, Ordering::SeqCst) + 1;
    if attempt > MAX_CRASH_RESTARTS {
        let mut inner = state.backend.inner.lock().unwrap();
        inner.error = Some("The local backend keeps stopping. Use Retry or check the logs.".into());
        return;
    }

    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        thread::sleep(Duration::from_millis(750 * attempt as u64));
        let state = handle.state::<AppState>();
        if state.backend.start(&handle).is_ok() {
            let _ = handle.emit(EVENT_RESTARTED, ());
        }
    });
}

/// Restart requested by the user or after a configuration change.
pub fn restart(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.backend.crash_restarts.store(0, Ordering::SeqCst);
    state.backend.start(app)?;
    let _ = app.emit(EVENT_RESTARTED, ());
    Ok(())
}

fn pick_port() -> Result<u16, String> {
    if let Ok(listener) = TcpListener::bind(("127.0.0.1", PREFERRED_PORT)) {
        return Ok(listener.local_addr().map_err(|e| e.to_string())?.port());
    }
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("No free local port: {e}"))?;
    Ok(listener.local_addr().map_err(|e| e.to_string())?.port())
}
