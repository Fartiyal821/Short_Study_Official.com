# ShortStudy Firebase setup

1. In Firebase Console, open project `shortstudy-de7d4` and enable **Authentication → Sign-in method → Email/Password**.
2. Create an admin user under **Authentication → Users**. Use a strong, unique password and do not publish credentials in this repository.
3. Create or select a Firestore database and deploy `firestore.rules`.
4. Replace `YOUR_FIREBASE_API_KEY` in `app.js` with the browser-safe Web API key from **Project settings → Your apps → Web app**. Firebase Web API keys are intended for browser use; authorization is enforced by Authentication and Firestore Rules.
5. Before production, replace the broad authenticated-write rule with a custom admin claim or allowlisted UID rule.
6. Update `canonicalOrigin` in `app.js` and the canonical domain in deployed metadata when the production domain is confirmed.

The admin workspace is available at `/admin.html`. It requires Email/Password authentication, lists all courses in real time, creates/updates courses, validates YouTube embed URLs, and publishes lesson posts. Publishing a post automatically changes an in-development course to `published`.
