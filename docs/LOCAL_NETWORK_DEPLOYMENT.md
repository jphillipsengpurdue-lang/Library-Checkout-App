Local Network Deployment (Boys & Girls Club)

Goal
- Run one shared Library Checkout database in one building.
- Keep traffic on the local network (no cloud hosting required).
- Make it easy for volunteers to add new devices.

What this implementation includes
- The app now supports a custom database path using the LIBRARY_DB_PATH environment variable.
- If LIBRARY_DB_PATH is not set, it still uses the local default library.db (same behavior as before).
- This enables a "host computer" setup where every device runs the app from the same shared folder and points to the same db file path.

Important note about SQLite on shared drives
- SQLite is file-based and can work for small teams, but shared/network writes can become a bottleneck.
- For best reliability at larger scale, move to a dedicated local API + server database later.
- For a Boys & Girls Club with light/moderate usage, this can be a practical low-cost starting point.

Recommended topology (Phase 1: low-cost)
1) Pick one always-on host PC in the building.
2) Create a shared folder, for example:
   - Windows: \\BGC-LIB-SERVER\LibraryCheckout\
3) Put the app files there.
4) Set LIBRARY_DB_PATH on each client to point to the shared database file, for example:
   \\BGC-LIB-SERVER\LibraryCheckout\data\library.db
5) Launch the app from each device.

Host computer setup (Windows)
1) Create service account/folder permissions
   - Create folder: C:\LibraryCheckout
   - Create subfolder: C:\LibraryCheckout\data
   - Share C:\LibraryCheckout as "LibraryCheckout"
   - Grant Read/Write to trusted staff/volunteer devices only.

2) Copy app files
   - Copy project/build files into C:\LibraryCheckout\app

3) Create startup script C:\LibraryCheckout\start-library-host.bat
   set LIBRARY_DB_PATH=C:\LibraryCheckout\data\library.db
   cd /d C:\LibraryCheckout\app
   npm start

4) Run once as admin to create database/tables.

Client device setup (Windows)
1) Ensure device can access \\BGC-LIB-SERVER\LibraryCheckout
2) Create startup shortcut or batch file on each client, for example:

   set LIBRARY_DB_PATH=\\BGC-LIB-SERVER\LibraryCheckout\data\library.db
   cd /d \\BGC-LIB-SERVER\LibraryCheckout\app
   npm start

3) Pin shortcut to desktop as "Library Checkout".

Volunteer quick add-new-device checklist
1) Connect device to BGC internal Wi-Fi/LAN.
2) Confirm file share opens: \\BGC-LIB-SERVER\LibraryCheckout
3) Install Node.js LTS (if needed).
4) Run app from shared folder using the client startup script above.
5) Log in with a known staff account and verify:
   - user login works
   - book checkout works
   - reading timer starts/stops
6) Add desktop shortcut and label the station.

Operations checklist (weekly)
- Backup the DB file:
  \\BGC-LIB-SERVER\LibraryCheckout\data\library.db
- Keep one dated backup copy on external drive/NAS.
- Test restore monthly on a spare machine.

Security checklist
- Keep share limited to internal network only.
- Do not expose SMB share to internet.
- Use strong admin passwords in app.
- Restrict write permissions to only necessary users/devices.

Troubleshooting
- "Database is locked"
  - Wait a moment and retry.
  - Confirm no backup process is holding a lock.
  - Restart app on one client at a time.

- "Cannot open database"
  - Confirm LIBRARY_DB_PATH points to valid path.
  - Confirm folder/share permissions include write access.

- Host PC rebooted
  - Restart host script first, then clients.

Phase 2 (when usage grows)
- Move to a local-only backend API service and a server database (PostgreSQL) on the host PC.
- Keep clients as app frontends connecting to that local API.
