//! Global (system-wide) keyboard shortcuts.
//!
//! Registration fails when another application already owns a combination;
//! those failures are reported back to the settings screen instead of
//! silently doing nothing.

use std::{collections::HashMap, str::FromStr, sync::Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::{preferences::Shortcuts, tray, windows, AppState};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    ToggleTimer,
    ResetTimer,
    ToggleFloating,
    ShowDashboard,
}

impl Action {
    fn key(self) -> &'static str {
        match self {
            Action::ToggleTimer => "toggleTimer",
            Action::ResetTimer => "resetTimer",
            Action::ToggleFloating => "toggleFloating",
            Action::ShowDashboard => "showDashboard",
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutIssue {
    pub action: &'static str,
    pub accelerator: String,
    pub message: String,
}

#[derive(Default)]
pub struct ShortcutRegistry {
    bound: Mutex<HashMap<u32, Action>>,
}

pub fn handle(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state() != ShortcutState::Pressed {
        return;
    }
    let action = {
        let state = app.state::<AppState>();
        let bound = state.shortcuts.bound.lock().unwrap();
        bound.get(&shortcut.id()).copied()
    };
    match action {
        Some(Action::ToggleTimer) => windows::send_action(app, "toggleTimer"),
        Some(Action::ResetTimer) => windows::send_action(app, "resetTimer"),
        Some(Action::ToggleFloating) => {
            if let Err(e) = windows::toggle_floating(app) {
                log::warn!("floating timer: {e}");
            }
            tray::refresh_floating_label(app);
        }
        Some(Action::ShowDashboard) => windows::toggle_main(app),
        None => {}
    }
}

/// Replaces every registered shortcut with `config`.
pub fn apply(app: &AppHandle, config: &Shortcuts) -> Vec<ShortcutIssue> {
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();

    let state = app.state::<AppState>();
    let mut bound = state.shortcuts.bound.lock().unwrap();
    bound.clear();

    let wanted = [
        (Action::ToggleTimer, &config.toggle_timer),
        (Action::ResetTimer, &config.reset_timer),
        (Action::ToggleFloating, &config.toggle_floating),
        (Action::ShowDashboard, &config.show_dashboard),
    ];

    let mut issues = Vec::new();
    for (action, accelerator) in wanted {
        let accelerator = accelerator.trim();
        if accelerator.is_empty() {
            continue;
        }
        let issue = |message: String| ShortcutIssue {
            action: action.key(),
            accelerator: accelerator.to_string(),
            message,
        };
        let shortcut = match Shortcut::from_str(accelerator) {
            Ok(s) => s,
            Err(e) => {
                issues.push(issue(format!("Not a valid shortcut: {e}")));
                continue;
            }
        };
        let id = shortcut.id();
        if let Some(other) = bound.get(&id) {
            issues.push(issue(format!("Already used for \"{}\" in this app.", other.key())));
            continue;
        }
        match manager.register(shortcut) {
            Ok(()) => {
                bound.insert(id, action);
            }
            Err(e) => {
                log::warn!("shortcut {accelerator} unavailable: {e}");
                issues.push(issue(
                    "Another application is already using this shortcut. Choose a different combination.".into(),
                ));
            }
        }
    }
    *state.shortcut_issues.lock().unwrap() = issues.clone();
    issues
}
