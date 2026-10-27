# Fix registration document upload permissions

Project: `fareride-app-0907-349`
Bucket: `fareride-app-0907-349.firebasestorage.app`

The registration form uploads documents to:

- `driverApplications/driver_<Firebase Auth UID>/<category>-<timestamp>-<filename>`
- `riderApplications/rider_<Firebase Auth UID>/<category>-<timestamp>-<filename>`

A `storage/unauthorized` response from these paths means Storage rejected the request. Changing Firestore rules or republishing GitHub Pages does not change Storage permissions.

## Publish in Firebase Console

1. Open https://console.firebase.google.com/project/fareride-app-0907-349/storage and select the configured bucket.
2. Open **Rules** and review the current rules. Copy the contents of this repository's `storage.rules` into the editor. If other application paths have their own rules, preserve those specific rules while adding the application upload match and its helper functions. Do not add public read/write rules.
3. Click **Publish**. If Firebase asks to enable Storage rules access to Firestore, accept that setup so active administrators can open application documents. The admin check uses `admins/<UID>.active == true`, matching the app's existing administrator records.
4. Reload registration and submit again with the same email and password. The account may already exist from the failed attempt. Select all required files again.

The rules allow authenticated applicants to create image/PDF files under their own application ID, each smaller than 10 MiB. They allow the applicant and active admins to fetch those files. They deny other users, anonymous access, overwrites, deletions, and listing. Applicant approval is not required before document upload.

The new face and vehicle photos are saved inside the private Firestore application document. License, insurance, and vehicle registration still use Firebase Storage.

## Deploy with authenticated Firebase CLI

From the repository root, after an administrator signs in:

```sh
firebase deploy --only storage --project fareride-app-0907-349
```

This deploys only Storage rules; it does not publish the pending ride photo sharing or other local Firestore changes.

## Verify locally

```sh
npm install --prefix tests/towing-rules --no-package-lock --no-audit --no-fund
tests/towing-rules/node_modules/.bin/firebase emulators:exec --only firestore,storage --project demo-fareride --config firebase.storage.test.json "node --test tests/towing-rules/storage-rules.test.mjs"
```

The emulator tests have not run in the current environment because emulator downloads are blocked. The production rules have not been published from this environment because Firebase has no authenticated administrator account.
