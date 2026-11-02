# Notch Buddy Desktop

Standalone desktop build of the app: React UI in a Tauri 2 shell, the Go API bundled as a local sidecar, and a PostgreSQL database the user connects on first launch. There is no central server.

## Architecture

```
Tauri shell (Rust, Frontend/src-tauri)
 ├─ starts Go backend sidecar  ──stdin──▶ token + DB URL + JWT secrets (from OS credential store)
 ├─ main window     ─▶ http://127.0.0.1:<port>/__desktop/bootstrap?token=…  (React dashboard)
 ├─ floating window ─▶ http://127.0.0.1:<port>/floating-timer               (always-on-top timer)
 ├─ system tray, global shortcuts, notifications, autostart, updater
 └─ on exit: POST /__desktop/shutdown, then kill if needed (stdin closing also stops Go)

Go backend (Backend, DESKTOP_MODE=true)
 ├─ listens on 127.0.0.1 only and rejects requests without the per-launch token
 ├─ serves the built React bundle (FRONTEND_DIR) and /api on the same origin
 ├─ setup mode when no database is configured (/__desktop/db/test, /__desktop/db/setup)
 └─ owns the global timer: /api/timer/* and the SSE stream /api/timer/events
```

The timer state is derived from `task_sessions` timestamps in the database, so it survives closing windows, restarting the app and sleep/wake without drift. Every window keeps its own SSE stream. The main window relays the state to the tray, runs tray and shortcut actions, renews the session and sends the completion notification.

## Prerequisites (build machine)

- Node.js 20+ and npm
- Go 1.22+
- Rust stable (`rustup`) with the MSVC toolchain on Windows
- Windows: Microsoft C++ Build Tools and WebView2 (already on Windows 10/11)

## Commands (run in `Frontend/`)

| Command | What it does |
| --- | --- |
| `npm run desktop:icons` | Generates every icon size from `src/assets/logo.png` into `src-tauri/icons` |
| `npm run desktop:dev` | Builds the desktop web bundle and the Go sidecar, then runs the app |
| `npm run desktop:build` | Produces the installers in `src-tauri/target/release/bundle/` (NSIS `.exe` and `.msi` on Windows) |
| `npm run build:backend -- --target x86_64-pc-windows-msvc` | Cross-compiles only the Go sidecar |

Run `npm run desktop:icons` once before the first build.

## Updates

1. `npx tauri signer generate -w ~/.tauri/notch-buddy.key`
2. Put the public key in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`, and point `endpoints` at your release feed (for example a GitHub Releases `latest.json`).
3. Set `bundle.createUpdaterArtifacts` to `true`.
4. Build with `TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) set, then upload the installer, its `.sig` file and `latest.json`.

Until this is configured, **Check for updates** in Desktop settings reports that updates are not set up.

## Where things are stored

| Data | Location |
| --- | --- |
| Database URL, JWT secrets | OS credential store, service `app.notchbuddy.desktop` |
| Preferences (tray, shortcuts, floating timer) | `%APPDATA%\app.notchbuddy.desktop\preferences.json` |
| Window positions and sizes | Window state plugin file in the same folder |
| Logs (shell and backend) | `%LOCALAPPDATA%\app.notchbuddy.desktop\logs` |

## Release test checklist (clean Windows machine)

- [ ] Install from the NSIS installer without admin rights. The Start menu entry and icon look right.
- [ ] First launch shows **Connect your database**. A wrong password, a missing database, a stopped server and a bad host each show their own message.
- [ ] **Test connection** succeeds. **Save and continue** creates the tables (migrations) and opens the login page.
- [ ] Register, log in, create a task and start it.
- [ ] Quit and relaunch: the database is not asked for again and the running timer continued while the app was closed.
- [ ] Windows Credential Manager contains `app.notchbuddy.desktop` entries and no plain-text URL exists in `preferences.json`.
- [ ] Close the dashboard: the app stays in the tray and the timer keeps running. The tray shows the status, and Start/Pause, Reset, the floating timer, Open dashboard and Quit all work.
- [ ] The floating timer stays on top of other apps, can be dragged, remembers its position, switches to compact mode, and closing it does not stop the timer.
- [ ] Changes from the dashboard, floating timer and tray appear everywhere within a second.
- [ ] Every global shortcut works from another app. Assigning a combination owned by another app shows a conflict message.
- [ ] Stop PostgreSQL while the app is open: the timer shows the database as unavailable. Start it again and use **Reconnect** in Desktop settings.
- [ ] End the `productivity-backend` process in Task Manager: it restarts and the UI reconnects.
- [ ] Put the computer to sleep with the timer running, then wake it: the time includes the sleep period and no session is duplicated.
- [ ] A task reaching its planned time shows a desktop notification while the dashboard is hidden.
- [ ] **Launch at login** starts the app minimized to the tray after you sign out and back in.
- [ ] A second launch focuses the running instance instead of starting another backend.
- [ ] **Quit** leaves no `productivity-backend` process running.
- [ ] Uninstall from Settings > Apps: app files are removed. Credentials and preferences can be removed by the user.
