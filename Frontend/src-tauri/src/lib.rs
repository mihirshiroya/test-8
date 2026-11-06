mod backend;
mod commands;
mod preferences;
mod secrets;
mod shortcuts;
mod tray;
mod windows;

use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex,
};

use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::AppHandleExt;

use crate::{
    backend::Backend,
    preferences::PreferenceStore,
    shortcuts::{ShortcutIssue, ShortcutRegistry},
    tray::TrayHandles,
};

pub const MINIMIZED_ARG: &str = "--minimized";

pub struct AppState {
    pub backend: Backend,
    pub preferences: PreferenceStore,
    pub tray: TrayHandles,
    pub shortcuts: ShortcutRegistry,
    pub shortcut_issues: Mutex<Vec<ShortcutIssue>>,
    /// Payload of the "Still focusing?" prompt while it is open.
    pub checkin: Mutex<Option<serde_json::Value>>,
    pub checkin_window_lock: Mutex<()>,
    /// Bumped on every schedule/cancel so stale native timers do nothing.
    pub checkin_generation: AtomicU64,
    quitting: AtomicBool,
}

impl AppState {
    pub fn is_quitting(&self) -> bool {
        self.quitting.load(Ordering::SeqCst)
    }
}

/// Saves window positions and stops the backend gracefully. Idempotent.
pub fn prepare_exit(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else { return };
    if state.quitting.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = app.save_window_state(windows::window_state_flags());
    state.backend.stop();
}

/// The only path that really exits: tray Quit, settings Exit, or closing the
/// dashboard when close-to-tray is off.
pub fn quit(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        prepare_exit(&handle);
        handle.exit(0);
    });
}

pub fn run() {
    let app = tauri::Builder::default()
        // Must be registered first: a second launch focuses the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            windows::show_main(app);
        }))
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(windows::window_state_flags())
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![MINIMIZED_ARG])))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| shortcuts::handle(app, shortcut, event))
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::get_preferences,
            commands::set_preferences,
            commands::get_shortcut_issues,
            commands::set_floating_compact,
            commands::export_preferences,
            commands::import_preferences,
            commands::has_database_url,
            commands::save_database_url,
            commands::forget_database_url,
            commands::backend_status,
            commands::restart_backend,
            commands::update_tray,
            commands::show_floating,
            commands::hide_floating,
            commands::toggle_floating,
            commands::is_floating_visible,
            commands::minimize_floating,
            commands::show_dashboard,
            commands::timer_action_via_main,
            commands::show_checkin,
            commands::hide_checkin,
            commands::schedule_checkin,
            commands::cancel_checkin,
            commands::get_checkin,
            commands::checkin_response,
            commands::notify,
            commands::get_autostart,
            commands::set_autostart,
            commands::app_info,
            commands::check_update,
            commands::install_update,
            commands::quit_app,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let preferences = PreferenceStore::load(&handle);
            let prefs = preferences.get();
            let start_hidden = prefs.start_minimized || std::env::args().any(|a| a == MINIMIZED_ARG);

            let tray = tray::create(&handle)?;
            app.manage(AppState {
                backend: Backend::new()?,
                preferences,
                tray,
                shortcuts: ShortcutRegistry::default(),
                shortcut_issues: Mutex::new(Vec::new()),
                checkin: Mutex::new(None),
                checkin_window_lock: Mutex::new(()),
                checkin_generation: AtomicU64::new(0),
                quitting: AtomicBool::new(false),
            });

            shortcuts::apply(&handle, &prefs.shortcuts);
            windows::create_main(&handle, !start_hidden)?;

            tauri::async_runtime::spawn_blocking(move || {
                let state = handle.state::<AppState>();
                if state.backend.start(&handle).is_err() {
                    // The splash page polls backend_status and offers Retry.
                    return;
                }
                if let Err(e) = windows::load_dashboard(&handle) {
                    log::error!("could not load the dashboard: {e}");
                }
                if prefs.show_floating_on_startup {
                    let _ = windows::show_floating(&handle);
                    tray::refresh_floating_label(&handle);
                }
            });
            Ok(())
        })
        .on_window_event(windows::on_window_event)
        .build(tauri::generate_context!())
        .expect("failed to build the Notch Buddy desktop app");

    app.run(|app, event| match event {
        // Windows are hidden rather than closed, so this only fires for an
        // explicit exit; make sure the backend is stopped first.
        RunEvent::ExitRequested { .. } | RunEvent::Exit => prepare_exit(app),
        _ => {}
    });
}
