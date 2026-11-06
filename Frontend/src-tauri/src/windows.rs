//! Main dashboard window and the always-on-top floating timer window.

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, Window, WindowEvent,
};
use std::sync::atomic::Ordering;

use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::AppState;

pub const MAIN: &str = "main";
pub const FLOATING: &str = "floating";
pub const CHECKIN: &str = "checkin";

pub const EVENT_CHECKIN: &str = "desktop://checkin";
pub const EVENT_CHECKIN_RESPONSE: &str = "desktop://checkin-response";

pub const EVENT_ACTION: &str = "desktop://action";
pub const EVENT_NAVIGATE: &str = "desktop://navigate";
pub const EVENT_FLOATING_VISIBILITY: &str = "desktop://floating-visibility";

const FLOATING_SIZE: (f64, f64) = (340.0, 188.0);
const FLOATING_COMPACT_SIZE: (f64, f64) = (260.0, 60.0);

/// Window chrome is decided in code, never restored from disk: a state file saved
/// while the native title bar was on would otherwise bring it back on launch.
pub fn window_state_flags() -> StateFlags {
    StateFlags::all() & !StateFlags::VISIBLE & !StateFlags::DECORATIONS
}

/// The main window starts on the bundled splash page and is navigated to the
/// backend once it is ready.
///
/// The native frame is removed on every platform; the app sidebar header draws
/// its own window controls (revealed on hover) and acts as the drag region.
pub fn create_main(app: &AppHandle, visible: bool) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title("Notch Buddy")
        .inner_size(1280.0, 820.0)
        .min_inner_size(960.0, 640.0)
        .center()
        .visible(visible)
        .decorations(false)
        .shadow(true);

    let window = builder.build()?;

    // The window-state plugin restores saved state during `build()`; re-apply
    // the frameless chrome afterwards so an old state file can't override it.
    let _ = window.set_decorations(false);

    Ok(window)
}

/// Points the main window at the backend unless it already shows it.
pub fn load_dashboard(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let Some(main) = app.get_webview_window(MAIN) else {
        return Ok(());
    };
    let on_backend = main
        .url()
        .map(|u| u.as_str().starts_with(&state.backend.origin()))
        .unwrap_or(false);
    if on_backend {
        return Ok(());
    }
    let url = state.backend.bootstrap_url("/")?;
    main.navigate(url).map_err(|e| e.to_string())
}

pub fn show_main(app: &AppHandle) {
    if let Some(main) = app.get_webview_window(MAIN) {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
}

pub fn toggle_main(app: &AppHandle) {
    if let Some(main) = app.get_webview_window(MAIN) {
        let focused = main.is_focused().unwrap_or(false);
        let visible = main.is_visible().unwrap_or(false);
        let minimized = main.is_minimized().unwrap_or(false);
        if visible && focused && !minimized {
            let _ = main.hide();
        } else {
            show_main(app);
        }
    }
}

/// Opens a route of the React app in the main window (e.g. settings).
pub fn open_route(app: &AppHandle, path: &str) {
    show_main(app);
    let _ = app.emit_to(MAIN, EVENT_NAVIGATE, path.to_string());
}

/// Forwards a timer action to the main window, which owns the user session.
pub fn send_action(app: &AppHandle, action: &str) {
    let _ = app.emit_to(MAIN, EVENT_ACTION, action.to_string());
}

fn floating_size(compact: bool) -> (f64, f64) {
    if compact {
        FLOATING_COMPACT_SIZE
    } else {
        FLOATING_SIZE
    }
}

fn ensure_floating(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(FLOATING) {
        return Ok(existing);
    }
    let state = app.state::<AppState>();
    if !state.backend.is_ready() {
        return Err("The timer is still starting. Try again in a moment.".into());
    }
    let compact = state.preferences.get().floating_compact;
    let (w, h) = floating_size(compact);
    let url = state.backend.bootstrap_url("/floating-timer")?;
    WebviewWindowBuilder::new(app, FLOATING, WebviewUrl::External(url))
        .title("Focus timer")
        .inner_size(w, h)
        .min_inner_size(FLOATING_COMPACT_SIZE.0, FLOATING_COMPACT_SIZE.1)
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .resizable(true)
        .shadow(true)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| format!("Could not open the floating timer: {e}"))
}

pub fn show_floating(app: &AppHandle) -> Result<(), String> {
    let window = ensure_floating(app)?;
    let _ = window.unminimize();
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_always_on_top(true);
    let _ = app.emit(EVENT_FLOATING_VISIBILITY, true);
    Ok(())
}

pub fn hide_floating(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(FLOATING) {
        let _ = window.hide();
        let _ = app.save_window_state(window_state_flags());
    }
    let _ = app.emit(EVENT_FLOATING_VISIBILITY, false);
}

pub fn is_floating_visible(app: &AppHandle) -> bool {
    app.get_webview_window(FLOATING)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

pub fn toggle_floating(app: &AppHandle) -> Result<(), String> {
    if is_floating_visible(app) {
        hide_floating(app);
        Ok(())
    } else {
        show_floating(app)
    }
}

pub fn apply_floating_compact(app: &AppHandle, compact: bool) {
    if let Some(window) = app.get_webview_window(FLOATING) {
        let (w, h) = floating_size(compact);
        let _ = window.set_size(LogicalSize::new(w, h));
    }
}

/* ------------------------------ check-in window --------------------------- */

const CHECKIN_SIZE: (f64, f64) = (380.0, 520.0);
const CHECKIN_MARGIN: f64 = 16.0;

fn ensure_checkin(app: &AppHandle) -> Result<WebviewWindow, String> {
    let state = app.state::<AppState>();
    let _creation = state.checkin_window_lock.lock().unwrap();
    if let Some(existing) = app.get_webview_window(CHECKIN) {
        return Ok(existing);
    }
    if !state.backend.is_ready() {
        return Err("The backend is not ready yet.".into());
    }
    let url = state.backend.bootstrap_url("/checkin")?;
    WebviewWindowBuilder::new(app, CHECKIN, WebviewUrl::External(url))
        .title("Still focusing?")
        .inner_size(CHECKIN_SIZE.0, CHECKIN_SIZE.1)
        // An independent top-level window must not be parented to MAIN:
        // Windows hides owned windows when their owner is minimized.
        .focusable(true)
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(true)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|e| format!("Could not open the check-in prompt: {e}"))
}

/// Pins the prompt to the left edge (vertically centred) of the screen the
/// user is currently working on, falling back to the primary monitor.
fn place_checkin_left(app: &AppHandle, window: &WebviewWindow) {
    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let height = (CHECKIN_SIZE.1 * scale) as i32;
    let x = area.position.x + (CHECKIN_MARGIN * scale) as i32;
    let y = area.position.y + ((area.size.height as i32 - height) / 2).max(0);
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

/// Shows the "Still focusing?" prompt above every other app on the desktop.
pub fn show_checkin(app: &AppHandle, payload: serde_json::Value) -> Result<(), String> {
    let state = app.state::<AppState>();
    *state.checkin.lock().unwrap() = Some(payload.clone());
    let window = ensure_checkin(app)?;
    window.set_size(LogicalSize::new(CHECKIN_SIZE.0, CHECKIN_SIZE.1)).map_err(|e| e.to_string())?;
    let was_visible = window.is_visible().unwrap_or(false);
    if !was_visible {
        place_checkin_left(app, &window);
    }
    let _ = window.unminimize();
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_always_on_top(true);
    let _ = app.emit_to(CHECKIN, EVENT_CHECKIN, payload);
    Ok(())
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Shows the prompt at `fire_at` (epoch ms) from a native thread, so it still
/// appears on time while the main webview is hidden or throttled by the OS.
/// Any later schedule/cancel supersedes this one.
pub fn schedule_checkin(app: &AppHandle, payload: serde_json::Value, fire_at: u64) -> Result<(), String> {
    let state = app.state::<AppState>();
    let generation = state.checkin_generation.fetch_add(1, Ordering::SeqCst) + 1;
    // Load the webview while there is time, not when its countdown starts.
    // This function is only called from a blocking worker, never the UI thread.
    ensure_checkin(app)?;
    let app = app.clone();
    std::thread::spawn(move || {
        // Poll the wall clock instead of one long sleep so system sleep/resume
        // doesn't push the prompt back.
        loop {
            if app.state::<AppState>().checkin_generation.load(Ordering::SeqCst) != generation {
                return;
            }
            if now_ms() >= fire_at {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        if app.state::<AppState>().checkin_generation.load(Ordering::SeqCst) == generation {
            if let Err(err) = show_checkin(&app, payload) {
                log::error!("check-in prompt failed: {err}");
            }
        }
    });
    Ok(())
}

/// Cancels a pending schedule and hides the prompt.
pub fn cancel_checkin(app: &AppHandle) {
    app.state::<AppState>()
        .checkin_generation
        .fetch_add(1, Ordering::SeqCst);
    hide_checkin(app);
}

pub fn hide_checkin(app: &AppHandle) {
    let state = app.state::<AppState>();
    *state.checkin.lock().unwrap() = None;
    if let Some(window) = app.get_webview_window(CHECKIN) {
        let _ = window.hide();
    }
    let _ = app.emit_to(CHECKIN, EVENT_CHECKIN, serde_json::Value::Null);
}

/// Relays only a current, valid answer to the timer owner.
pub fn checkin_response(app: &AppHandle, action: &str, task_id: &str, deadline: u64) -> Result<(), String> {
    if !matches!(action, "continue" | "pause" | "timeout") {
        return Err("Invalid check-in action.".into());
    }
    let state = app.state::<AppState>();
    let mut current = state.checkin.lock().unwrap();
    let matches = current.as_ref().is_some_and(|p| {
        p["taskId"].as_str() == Some(task_id) && p["deadline"].as_u64() == Some(deadline)
    });
    if !matches {
        return Err("This check-in is no longer active.".into());
    }
    // Deliver before clearing so a delivery failure can be retried.
    app.emit_to(MAIN, EVENT_CHECKIN_RESPONSE, serde_json::json!({
        "taskId": task_id,
        "action": action,
    })).map_err(|e| e.to_string())?;
    *current = None;
    drop(current);
    cancel_checkin(app);
    Ok(())
}

/// Closing either window hides it; the timer keeps running in the backend.
/// Without close-to-tray, closing the dashboard quits the whole app.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    let app = window.app_handle();
    let state = app.state::<AppState>();
    if state.is_quitting() {
        return;
    }
    match window.label() {
        FLOATING => {
            api.prevent_close();
            hide_floating(app);
        }
        CHECKIN => {
            api.prevent_close();
            let current = state.checkin.lock().unwrap().clone();
            if let Some(payload) = current {
                if let (Some(task_id), Some(deadline)) = (payload["taskId"].as_str(), payload["deadline"].as_u64()) {
                    let _ = checkin_response(app, "continue", task_id, deadline);
                }
            }
        }
        MAIN => {
            api.prevent_close();
            if state.preferences.get().close_to_tray {
                let _ = app.save_window_state(window_state_flags());
                let _ = window.hide();
            } else {
                crate::quit(app);
            }
        }
        _ => {}
    }
}
