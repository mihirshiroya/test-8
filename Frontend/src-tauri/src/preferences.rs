//! Non-secret desktop preferences, stored as JSON in the app config folder.
//! Mirrored by DesktopPreferences in Frontend/src/desktop/types.ts.

use std::{fs, path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Shortcuts {
    pub toggle_timer: String,
    pub reset_timer: String,
    pub toggle_floating: String,
    pub show_dashboard: String,
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            toggle_timer: "CommandOrControl+Alt+Shift+Space".into(),
            reset_timer: "CommandOrControl+Alt+Shift+R".into(),
            toggle_floating: "CommandOrControl+Alt+Shift+F".into(),
            show_dashboard: "CommandOrControl+Alt+Shift+D".into(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    pub close_to_tray: bool,
    pub start_minimized: bool,
    pub show_floating_on_startup: bool,
    pub floating_compact: bool,
    pub notifications_enabled: bool,
    pub shortcuts: Shortcuts,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            close_to_tray: true,
            start_minimized: false,
            show_floating_on_startup: false,
            floating_compact: false,
            notifications_enabled: true,
            shortcuts: Shortcuts::default(),
        }
    }
}

pub struct PreferenceStore {
    path: PathBuf,
    current: Mutex<Preferences>,
}

impl PreferenceStore {
    pub fn load(app: &AppHandle) -> Self {
        let path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("notch-buddy"))
            .join("preferences.json");
        let current = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
        Self { path, current: Mutex::new(current) }
    }

    pub fn get(&self) -> Preferences {
        self.current.lock().unwrap().clone()
    }

    pub fn set(&self, next: Preferences) -> Result<(), String> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir).map_err(|e| format!("Could not create the settings folder: {e}"))?;
        }
        let raw = serde_json::to_string_pretty(&next).map_err(|e| e.to_string())?;
        fs::write(&self.path, raw).map_err(|e| format!("Could not save settings: {e}"))?;
        *self.current.lock().unwrap() = next;
        Ok(())
    }

    pub fn update(&self, f: impl FnOnce(&mut Preferences)) -> Result<Preferences, String> {
        let mut next = self.get();
        f(&mut next);
        self.set(next.clone())?;
        Ok(next)
    }
}
