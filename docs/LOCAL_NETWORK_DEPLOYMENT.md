Local Network Hosting (Streamlined for Today)

This guide is for a Boys & Girls Club deployment where one host device runs the shared service and any number of client devices can connect over the same building network.

New architecture now included
- Host runs `lan-server.js` (single shared data/service process).
- Clients run the desktop app and call the host via `LIBRARY_SERVER_URL`.
- This avoids shared-network SQLite file locking between many client apps.

What you need
- Host computer on LAN (wired preferred), always on during hours.
- Node.js 18+ on host and clients.
- This project folder on host and clients (or packaged app with same env vars).

HOST SETUP (you do this once)
1) On host, choose folder, for example:
   C:\LibraryCheckout
2) Put project files there.
3) Set DB location (host local disk), example:
   set LIBRARY_DB_PATH=C:\LibraryCheckout\data\library.db
4) Start LAN server:
   npm run start:server
5) Confirm server health from host browser:
   http://localhost:4312/health

If host machine name is `BGC-LIB-SERVER`, your client URL will be:
- http://BGC-LIB-SERVER:4312

CLIENT SETUP (repeat per device)
1) Install Node.js 18+.
2) Place app files on the client.
3) Launch app with server URL env var:
   set LIBRARY_SERVER_URL=http://BGC-LIB-SERVER:4312
   npm start

That is it. The client app will automatically use LAN server APIs when `LIBRARY_SERVER_URL` is set.

Volunteer add-new-device quick checklist
1) Connect device to BGC LAN/Wi-Fi.
2) Install Node.js.
3) Copy app folder.
4) Create desktop shortcut/script with:
   set LIBRARY_SERVER_URL=http://BGC-LIB-SERVER:4312
   npm start
5) Validate login + checkout + return.

Recommended helper scripts (Windows)
- Client start script `start-client.bat`:
  set LIBRARY_SERVER_URL=http://BGC-LIB-SERVER:4312
  cd /d C:\LibraryCheckout\app
  npm start

- Host start script `start-host.bat`:
  set LIBRARY_DB_PATH=C:\LibraryCheckout\data\library.db
  cd /d C:\LibraryCheckout\app
  npm run start:server

Capacity guidance
- This is much better than network-shared SQLite file access.
- Practical max depends on host CPU/disk/network and usage pattern.
- Start with expected peak load and monitor response times.
- If growth is very high later, move DB to PostgreSQL on the same host.

Troubleshooting
- Client cannot connect:
  - check `LIBRARY_SERVER_URL`
  - check host firewall allows TCP 4312 on LAN
  - check `http://HOST:4312/health`
- Slowdowns:
  - ensure host uses SSD and wired network
  - reduce other heavy apps on host

Security
- Keep LAN-only access (no router port forwarding).
- Use strong admin password and change default admin immediately.
