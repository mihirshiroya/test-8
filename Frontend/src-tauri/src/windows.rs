//! Main dashboard window and the always-on-top floating timer window.

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window,
    WindowEvent,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::AppState;

pub const MAIN: &str = "main";
pub const FLOATING: &str = "floating";

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
