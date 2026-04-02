# Kids Library Checkout App

An educational Electron app that helps kids manage library books while learning to code.

## Abstract
The Kids Library Checkout App is a desktop-based library management system designed for youth learning environments, such as school and community reading programs. Built with Electron, it combines practical library operations—book search, checkout/return workflows, and role-based account access—with an educational interface that helps students understand how software works through source code visibility. The project emphasizes accessibility and real-world deployment: it supports local single-device use, shared local-network hosting for multi-device scenarios, and one-click Windows setup/build scripts for volunteers and non-technical facilitators. Overall, the application serves a dual purpose as both an operational tool for organizing books and a hands-on introduction to applied coding in a familiar, literacy-focused context.

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
```

If startup reports `Cannot find module 'sqlite3'`, run:
```bash
npm install
npm run rebuild:electron
```

## ChromeOS (Single Device, No Server)
If you want to run this app on one Chromebook only (with no LAN/server hosting), use the Linux environment on ChromeOS (Crostini).

### One-click setup
1. Enable **Linux development environment** on the Chromebook.
2. Copy this project folder into Linux files.
3. In a Linux terminal, run:

```bash
chmod +x ONE_CLICK_SETUP_CHROMEOS.sh START_LIBRARY.sh scripts/chromeos/one-click-setup.sh
./ONE_CLICK_SETUP_CHROMEOS.sh
```

Notes:
- This runs the app locally on that one device with the local SQLite database file.
- You do **not** need to run `npm run start:server` for this setup.
- Windows installer flows do not apply on ChromeOS.
- The setup creates one consolidated starter script: `START_LIBRARY.sh`.

### Daily launch (single starter)
```bash
./START_LIBRARY.sh
```

## Usage Guides
- For students/readers (normal users): `docs/USER_GUIDE.md`
- For administrators: `docs/ADMIN_GUIDE.md`

## Local Network (BGC) Deployment
For sharing one database across devices in the same building, see:
- `docs/LOCAL_NETWORK_DEPLOYMENT.md`

You can override the database location with environment variable `LIBRARY_DB_PATH`.


## Quick LAN Host/Client Mode
- Start shared host service: `npm run start:server`
- Point clients to host: set `LIBRARY_SERVER_URL` (example: `http://BGC-LIB-SERVER:4312`)
- Then run desktop app normally: `npm start`

See full instructions in `docs/LOCAL_NETWORK_DEPLOYMENT.md`.


## Build a Windows .exe Installer (CLI)
```bash
npm install
npm run dist:win
```

This uses NSIS via `electron-builder` and creates an install wizard (.exe), desktop shortcut, and Start Menu entry.

If you hit `Could not locate the bindings file` (sqlite3), run:
```bash
npm install
npm run rebuild:electron
```
