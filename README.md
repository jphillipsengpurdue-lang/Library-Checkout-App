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

The setup script auto-installs Node.js LTS (via winget) if needed and installs app dependencies.


## Build a Windows .exe Installer
Yes — you can generate a proper installer now.

### Fastest way (double-click)
1. On a Windows machine, double-click `BUILD_WINDOWS_INSTALLER.bat`.
2. Wait for build to finish.
3. Find installer in `dist/` (example: `Library Checkout App-Setup-1.0.0.exe`).

### CLI way
```bash
npm install
npm run dist:win
```

This uses NSIS via `electron-builder` and creates an install wizard (.exe), desktop shortcut, and Start Menu entry.
