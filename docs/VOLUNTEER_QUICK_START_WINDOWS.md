Volunteer Quick Start (Windows)

This is written for non-technical volunteers.

Before you begin
- Connect the device to the building Wi-Fi/LAN.
- Ask staff for this value: HOST SERVER URL (example: http://BGC-LIB-SERVER:4312)

Steps (Client device)
1) Download project ZIP from GitHub.
2) Right-click ZIP -> Extract All.
3) Open extracted folder.
4) Double-click `ONE_CLICK_SETUP.bat`.
5) When asked, type `CLIENT`.
6) When asked for server URL, paste the URL from staff.
7) Wait until it says setup finished.
8) Use the desktop icon: `Library Checkout`.

Steps (Host device - staff/admin only)
1) Double-click `ONE_CLICK_SETUP.bat`.
2) Type `HOST`.
3) Accept defaults unless staff wants custom path/port.
4) Use desktop icon: `Library Checkout - Host Server`.
5) Keep this running during library hours.

Common issues
- "winget not available"
  - Install "App Installer" from Microsoft Store, then run setup again.
- "Cannot connect to server"
  - Check host computer is on and host shortcut is running.
  - Check URL is exactly right.

What volunteers do NOT need to do
- They do not need to manually install Node.js.
- They do not need to run terminal commands.
- They do not need to edit files.


Installer option (recommended for distribution)
- Admin can build a standard Windows installer by running `BUILD_WINDOWS_INSTALLER.bat`.
- Share the generated `.exe` from the `dist` folder with volunteers.
- Volunteers then install by double-clicking installer and following wizard prompts.


If you see "Could not locate the bindings file" (sqlite3)
- Run `ONE_CLICK_SETUP.bat` again on that device.
- The setup now rebuilds Electron native modules automatically.


Portable app EXE option
- If you do not want an installer wizard, admins can run `BUILD_WINDOWS_APP_EXE.bat`.
- Share the generated portable `.exe` from `dist` for quick app launch.
