//! Database URL and JWT secrets live in the OS credential store (Windows
//! Credential Manager, macOS Keychain, Secret Service on Linux). They are only
//! ever handed to the Go backend over its stdin pipe.

use keyring::Entry;
use rand::{distributions::Alphanumeric, Rng};
use serde_json::json;

const SERVICE: &str = "app.notchbuddy.desktop";
const DATABASE_URL: &str = "database-url";
const JWT_SECRET: &str = "jwt-secret";
const JWT_REFRESH_SECRET: &str = "jwt-refresh-secret";

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|e| format!("The system credential store is unavailable: {e}"))
}

fn get(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(value) if !value.is_empty() => Ok(Some(value)),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not read \"{name}\" from the system credential store: {e}")),
    }
}

fn set(name: &str, value: &str) -> Result<(), String> {
    entry(name)?
        .set_password(value)
        .map_err(|e| format!("Could not save \"{name}\" to the system credential store: {e}"))
}

fn delete(name: &str) -> Result<(), String> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Could not remove \"{name}\" from the system credential store: {e}")),
    }
}

/// Generated once per installation so login sessions survive app restarts.
fn ensure_random(name: &str) -> Result<String, String> {
    if let Some(existing) = get(name)? {
        return Ok(existing);
    }
    let value = random_token(64);
    set(name, &value)?;
    Ok(value)
}

pub fn random_token(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

pub fn has_database_url() -> bool {
    matches!(get(DATABASE_URL), Ok(Some(_)))
}

pub fn save_database_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("postgres://") || url.starts_with("postgresql://")) {
        return Err("Only PostgreSQL connection URLs are supported.".into());
    }
    set(DATABASE_URL, url)
}

pub fn forget_database_url() -> Result<(), String> {
    delete(DATABASE_URL)
}

/// The single JSON line the backend reads from stdin at startup.
pub fn backend_secrets_line(token: &str) -> Result<String, String> {
    let payload = json!({
        "token": token,
        "databaseUrl": get(DATABASE_URL)?.unwrap_or_default(),
        "jwtSecret": ensure_random(JWT_SECRET)?,
        "jwtRefreshSecret": ensure_random(JWT_REFRESH_SECRET)?,
    });
    Ok(format!("{payload}\n"))
}
