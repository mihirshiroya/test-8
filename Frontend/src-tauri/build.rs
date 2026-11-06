// Keep this list in sync with `generate_handler!` in src/lib.rs. Declaring the
// app manifest generates `allow-<command>` permissions, which are required for
// the pages served by the local backend (a remote origin to Tauri) to invoke
// app commands at all.
const COMMANDS: &[&str] = &[
    "get_preferences",
    "set_preferences",
    "get_shortcut_issues",
    "set_floating_compact",
    "export_preferences",
    "import_preferences",
    "has_database_url",
    "save_database_url",
    "forget_database_url",
    "backend_status",
    "restart_backend",
    "update_tray",
    "show_floating",
    "hide_floating",
    "toggle_floating",
    "is_floating_visible",
    "minimize_floating",
    "show_dashboard",
    "timer_action_via_main",
    "show_checkin",
    "hide_checkin",
    "schedule_checkin",
    "cancel_checkin",
    "get_checkin",
    "checkin_response",
    "notify",
    "get_autostart",
    "set_autostart",
    "app_info",
    "check_update",
    "install_update",
    "quit_app",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
