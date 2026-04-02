# Library Checkout App - Admin Guide

This guide is for admin users managing circulation and accounts.

## 1) Log in as admin
1. Open the app and log in with an admin account.
2. Open the admin section after login.

## 2) Manage users
Admins can:
- Create users.
- Change user roles (student/admin).
- Change or reset passwords.
- Delete users when needed.

## 3) Manage circulation
Admins can:
- Review all active checkouts.
- Search all checkouts.
- Process book returns.

## 4) Verify daily operations
At start of day (or after setup), verify:
1. Login works.
2. Book search works.
3. Checkout works.
4. Return works.

## 5) First login on a brand-new database
If no users exist yet, the app creates a default admin:
- Username: `admin`
- Password: `admin123`

Immediately change the default admin password after first login.

## Security and operations tips
- Use strong admin passwords.
- Avoid sharing admin credentials.
- Keep regular backups of `library.db`.
- For one-device setups, keep the app and Node dependencies updated.
