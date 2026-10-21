# Stockroom (Firebase version)

An inventory manager with email/password login and cloud saving, using plain HTML, CSS and JavaScript.

## Files
- `index.html`: page structure
- `styles.css`: all styling (supports light and dark mode)
- `app.js`: the app logic
- `firebase-config.js`: your Firebase settings (you fill this in)
- `firestore.rules`: security rules so each user only sees their own data

## Setup
1. Go to https://console.firebase.google.com and create a project.
2. **Authentication**: open Build > Authentication > Get started, then enable the **Email/Password** provider.
3. **Firestore**: open Build > Firestore Database > Create database (production mode), then open the **Rules** tab, paste in the contents of `firestore.rules`, and click Publish.
4. **Web app**: in Project settings > Your apps, click the web icon (</>), register an app, and copy the `firebaseConfig` values into `firebase-config.js`.
5. **Authorized domains**: in Authentication > Settings > Authorized domains, add the domain you host on (`localhost` is already allowed).

## Run it
The app uses JavaScript modules, so it must be served over http, not opened by double-clicking.
- Locally: in this folder run `npx serve` (or `python3 -m http.server 8000`) and open the address it prints.
- Online: upload the folder to Firebase Hosting, GitHub Pages, Netlify or Cloudflare Pages.

## Notes
- Data is stored in one Firestore document per user at `users/<uid>`.
- The Firebase config values are meant to be public. The rules in `firestore.rules` are what protect the data, so don't skip step 3.
