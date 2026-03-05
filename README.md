# Kids Library Checkout App

An educational Electron app that helps kids manage library books while learning to code.

## Features
- Book search using Google Books API
- User authentication (students & admins)
- Book checkout/return system
- Admin panel for user management
- Source code viewer for learning

## Setup
```bash
npm install
npm start


## Local Network (BGC) Deployment
For sharing one database across devices in the same building, see:
- `docs/LOCAL_NETWORK_DEPLOYMENT.md`

You can override the database location with environment variable `LIBRARY_DB_PATH`.


## Quick LAN Host/Client Mode
- Start shared host service: `npm run start:server`
- Point clients to host: set `LIBRARY_SERVER_URL` (example: `http://BGC-LIB-SERVER:4312`)
- Then run desktop app normally: `npm start`

See full instructions in `docs/LOCAL_NETWORK_DEPLOYMENT.md`.


## One-Click Setup for Volunteers (Windows)
1. Download this repository as ZIP and extract it.
2. Double-click `ONE_CLICK_SETUP.bat`.
3. Type `HOST` (for the host machine) or `CLIENT` (for regular devices).
4. Use the desktop shortcut created by setup.

The setup script auto-installs Node.js LTS (via winget), installs app dependencies, and rebuilds Electron native modules (sqlite3) automatically.


## Build a Windows .exe Installer
Yes — you can generate a proper installer now.

### Fastest way (double-click)
1. On a Windows machine, double-click `BUILD_WINDOWS_INSTALLER.bat`.
2. A console window will stay open and show progress (install/rebuild/build).
3. When done, it automatically opens the `dist/` folder.
4. If something fails, check `build-installer.log` in the project root.

### CLI way
```bash
npm install
npm run dist:win
```

This uses NSIS via `electron-builder` and creates an install wizard (.exe), desktop shortcut, and Start Menu entry.


If you hit `Could not locate the bindings file` (sqlite3), run `ONE_CLICK_SETUP.bat` again to trigger native module rebuild for Electron.
