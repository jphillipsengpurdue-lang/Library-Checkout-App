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
