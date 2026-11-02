//! System tray icon and menu. Timer status text is pushed by the main
//! window (which holds the user's session) through the `update_tray` command.

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

use crate::{windows, AppState};

pub const TRAY_ID: &str = "main-tray";

pub struct TrayHandles {
    status: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
    reset: MenuItem<Wry>,
    floating: MenuItem<Wry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatus {
    /// e.g. "Focus · 12 min left" or "Sign in to use the timer".
    pub label: String,
    /// Shown as the tray tooltip (and next to the icon on macOS).
    pub tooltip: String,
    pub running: bool,
    pub has_task: bool,
}

pub fn create(app: &AppHandle) -> tauri::Result<TrayHandles> {
    let status = MenuItem::with_id(app, "status", "Timer idle", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Start timer", false, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset", "Reset session", false, None::<&str>)?;
    let floating = MenuItem::with_id(app, "floating", "Show floating timer", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(app, "dashboard", "Open dashboard", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Desktop settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Notch Buddy", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &reset,
            &PredefinedMenuItem::separator(app)?,
            &floating,
            &dashboard,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Notch Buddy")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(on_tray_event);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    Ok(TrayHandles { status, toggle, reset, floating })
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "toggle" => windows::send_action(app, "toggleTimer"),
        "reset" => windows::send_action(app, "resetTimer"),
        "floating" => {
            if let Err(e) = windows::toggle_floating(app) {
                log::warn!("floating timer: {e}");
            }
            refresh_floating_label(app);
        }
        "dashboard" => windows::show_main(app),
        "settings" => windows::open_route(app, "/settings/desktop"),
        "quit" => crate::quit(app),
        _ => {}
    }
}

fn on_tray_event(tray: &TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        windows::show_main(tray.app_handle());
    }
}

pub fn update(app: &AppHandle, status: &TrayStatus) {
    let state = app.state::<AppState>();
    let handles = &state.tray;
    let _ = handles.status.set_text(&status.label);
    let _ = handles.toggle.set_text(if status.running { "Pause timer" } else { "Start timer" });
    let _ = handles.toggle.set_enabled(status.has_task);
    let _ = handles.reset.set_enabled(status.running);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(&status.tooltip));
        #[cfg(target_os = "macos")]
        let _ = tray.set_title(if status.running { Some(status.tooltip.as_str()) } else { None });
    }
}

pub fn refresh_floating_label(app: &AppHandle) {
    let state = app.state::<AppState>();
    let text = if windows::is_floating_visible(app) {
        "Hide floating timer"
    } else {
        "Show floating timer"
    };
    let _ = state.tray.floating.set_text(text);
}
