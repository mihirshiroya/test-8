//! Commands invoked from the React app through `window.__TAURI__.core.invoke`.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

use crate::{
    backend::{self, BackendStatus},
    preferences::Preferences,
    secrets,
    shortcuts::{self, ShortcutIssue},
    tray::{self, TrayStatus},
    windows, AppState,
};

type CmdResult<T> = Result<T, String>;

pub const EVENT_PREFERENCES: &str = "desktop://preferences";

/// Runs blocking backend work off the async runtime threads.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> CmdResult<T> + Send + 'static) -> CmdResult<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

/* ------------------------------- preferences ------------------------------ */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePreferencesResult {
    preferences: Preferences,
    shortcut_issues: Vec<ShortcutIssue>,
}

#[tauri::command]
pub fn get_preferences(app: AppHandle) -> Preferences {
    app.state::<AppState>().preferences.get()
}

#[tauri::command]
pub fn set_preferences(app: AppHandle, preferences: Preferences) -> CmdResult<SavePreferencesResult> {
    let state = app.state::<AppState>();
    let previous = state.preferences.get();
    state.preferences.set(preferences.clone())?;

    if previous.floating_compact != preferences.floating_compact {
        windows::apply_floating_compact(&app, preferences.floating_compact);
    }
    let shortcut_issues = shortcuts::apply(&app, &preferences.shortcuts);
    let _ = app.emit(EVENT_PREFERENCES, preferences.clone());
    Ok(SavePreferencesResult { preferences, shortcut_issues })
}

#[tauri::command]
pub fn get_shortcut_issues(app: AppHandle) -> Vec<ShortcutIssue> {
    let state = app.state::<AppState>();
    let issues = state.shortcut_issues.lock().unwrap().clone();
    issues
}

#[tauri::command]
pub fn set_floating_compact(app: AppHandle, compact: bool) -> CmdResult<Preferences> {
    let state = app.state::<AppState>();
    let preferences = state.preferences.update(|p| p.floating_compact = compact)?;
    windows::apply_floating_compact(&app, compact);
    let _ = app.emit(EVENT_PREFERENCES, preferences.clone());
    Ok(preferences)
}

/// Writes the non-secret preferences to a file the user picks.
#[tauri::command]
pub async fn export_preferences(app: AppHandle) -> CmdResult<Option<String>> {
    let Some(target) = app
        .dialog()
        .file()
        .add_filter("Settings", &["json"])
        .set_file_name("notch-buddy-settings.json")
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = target.into_path().map_err(|e| e.to_string())?;
    let raw = serde_json::to_string_pretty(&app.state::<AppState>().preferences.get()).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| format!("Could not write the file: {e}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn import_preferences(app: AppHandle) -> CmdResult<Option<SavePreferencesResult>> {
    let Some(source) = app
        .dialog()
        .file()
        .add_filter("Settings", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = source.into_path().map_err(|e| e.to_string())?;
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("Could not read the file: {e}"))?;
    let preferences: Preferences =
        serde_json::from_str(&raw).map_err(|_| "That file is not a Notch Buddy settings export.".to_string())?;
    set_preferences(app, preferences).map(Some)
}

/* -------------------------------- database -------------------------------- */

#[tauri::command]
pub fn has_database_url() -> bool {
    secrets::has_database_url()
}

/// Stores the URL in the OS credential store and restarts the backend with it.
#[tauri::command]
pub async fn save_database_url(app: AppHandle, url: String) -> CmdResult<()> {
    secrets::save_database_url(&url)?;
    blocking(move || backend::restart(&app)).await
}

#[tauri::command]
pub async fn forget_database_url(app: AppHandle) -> CmdResult<()> {
    secrets::forget_database_url()?;
    blocking(move || backend::restart(&app)).await
}

/* --------------------------------- backend -------------------------------- */

#[tauri::command]
pub fn backend_status(app: AppHandle) -> BackendStatus {
    app.state::<AppState>().backend.status()
}

#[tauri::command]
pub async fn restart_backend(app: AppHandle) -> CmdResult<()> {
    blocking(move || {
        backend::restart(&app)?;
        windows::load_dashboard(&app)
    })
    .await
}

/* ------------------------------ timer surfaces ---------------------------- */

#[tauri::command]
pub fn update_tray(app: AppHandle, status: TrayStatus) {
    tray::update(&app, &status);
}

#[tauri::command]
pub fn show_floating(app: AppHandle) -> CmdResult<()> {
    let result = windows::show_floating(&app);
    tray::refresh_floating_label(&app);
    result
}

#[tauri::command]
pub fn hide_floating(app: AppHandle) {
    windows::hide_floating(&app);
    tray::refresh_floating_label(&app);
}

#[tauri::command]
pub fn toggle_floating(app: AppHandle) -> CmdResult<bool> {
    windows::toggle_floating(&app)?;
    tray::refresh_floating_label(&app);
    Ok(windows::is_floating_visible(&app))
}

#[tauri::command]
pub fn is_floating_visible(app: AppHandle) -> bool {
    windows::is_floating_visible(&app)
}

#[tauri::command]
pub fn minimize_floating(app: AppHandle) {
    if let Some(window) = app.get_webview_window(windows::FLOATING) {
        let _ = window.minimize();
    }
}

#[tauri::command]
pub fn show_dashboard(app: AppHandle, path: Option<String>) {
    match path {
        Some(path) => windows::open_route(&app, &path),
        None => windows::show_main(&app),
    }
}

/// Forwards a timer action from the floating window to the main window.
#[tauri::command]
pub fn timer_action_via_main(app: AppHandle, action: String) {
    windows::send_action(&app, &action);
}

#[tauri::command]
pub fn notify(app: AppHandle, title: String, body: String) -> CmdResult<()> {
    if !app.state::<AppState>().preferences.get().notifications_enabled {
        return Ok(());
    }
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

/* ------------------------------ app lifecycle ----------------------------- */

#[tauri::command]
pub fn get_autostart(app: AppHandle) -> CmdResult<bool> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> CmdResult<bool> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|e| format!("Could not change the startup setting: {e}"))?;
    launcher.is_enabled().map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    name: String,
    log_dir: Option<String>,
    config_dir: Option<String>,
}

#[tauri::command]
pub fn app_info(app: AppHandle) -> AppInfo {
    let info = app.package_info();
    let path = app.path();
    AppInfo {
        version: info.version.to_string(),
        name: info.name.clone(),
        log_dir: path.app_log_dir().ok().map(|p| p.to_string_lossy().into_owned()),
        config_dir: path.app_config_dir().ok().map(|p| p.to_string_lossy().into_owned()),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
    date: Option<String>,
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> CmdResult<Option<UpdateInfo>> {
    let updater = app.updater().map_err(|e| format!("Updates are not configured: {e}"))?;
    let update = updater
        .check()
        .await
        .map_err(|e| format!("Could not check for updates: {e}"))?;
    Ok(update.map(|u| UpdateInfo {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
        date: u.date.map(|d| d.to_string()),
    }))
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> CmdResult<()> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Err("You already have the latest version.".into());
    };
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| format!("The update could not be installed: {e}"))?;
    crate::prepare_exit(&app);
    app.restart();
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    crate::quit(&app);
}
