# Firebase account setup

Tajiri POS uses Firebase Authentication for email/password sign-in and Cloud
Firestore for account roles. Passwords are handled by Firebase Authentication;
they are not saved in the POS account documents or local browser storage.

## Enable Firebase services

1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**.
2. Create a **Cloud Firestore** database.
3. Publish the rules from [`firestore.rules`](./firestore.rules) in
   **Firestore Database → Rules**.
4. Check that the Firebase web configuration in `index.html` belongs to this
   same project.
5. Serve the app from an HTTP/HTTPS origin rather than opening the HTML files
   directly with `file://`. Add the app's host (including `localhost` for local
   development) under **Authentication → Settings → Authorized domains**.
6. Open the admin setup page and create the first admin using
   `konyangodancan@gmail.com`. Verify the email using the link Firebase sends,
   then return to the Admin sign-in page and sign in to finish setup. The
   Firestore rules require a verified address and reject first-admin claims
   from every other email.
7. In **Staff access**, an admin can create cashier accounts and additional
   administrator accounts. The limit is three administrators total, including
   the first admin. The limit is enforced by the Firestore bootstrap document
   and rules, not just by the page UI. New staff must verify their email before
   signing in.

The email address in `firestore.rules` and `welcome.js` is the first-admin
allowlist. If that address changes before setup, update both locations and
republish the Firestore rules. Publish the updated rules after changing them;
older deployed rules will block registration or staff account creation.

## Existing local accounts

Accounts created before Firebase integration exist only in that browser's local
storage. Their password hashes cannot be converted into Firebase passwords.
Create the cloud admin with the authorized email, then recreate staff accounts
from the Admin workspace and assign each a password. Staff should use the new
cloud credentials in each browser.

Sales, inventory, settings, and other POS data remain stored locally on each
device; this change centralizes authentication and account roles only. It does
not synchronize business data between browsers.
