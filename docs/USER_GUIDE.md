# Library Checkout App - User Guide (Students/Readers)

This guide is for normal users checking out and returning books.

## 1) Log in
1. Open the app.
2. Enter your username and password.
3. Select **Log In**.

## 2) Find books
1. Go to the search area.
2. Search by title, author, or keyword.
3. Review the results list.

## 3) Check out a book
1. Choose a book from search results.
2. Select the checkout action.
3. Confirm the success message.

## 4) View your checked-out books
1. Open **My Checkouts**.
2. Review current books and due-date information (if shown).

## 5) Return a book
1. In **My Checkouts**, choose the book you are returning.
2. Select return.
3. Confirm the success message.

## 6) Optional reading features
- Start and end reading sessions.
- Set reading goals.
- View reading stats/progress.

## Troubleshooting
- If login fails, verify your username/password with an admin.
- If the app does not start due to sqlite3, ask the device manager to run:
  ```bash
  npm install
  npm run rebuild:electron
  npm start
  ```
