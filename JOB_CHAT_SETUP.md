# Activate live job chat

The rider, assigned driver and active FareRide admins share an append-only conversation at `rides/{rideId}/messages/{messageId}`. Passenger, tow and bike jobs all use this conversation. A rider and admin can chat before assignment; only the assigned driver joins. Sending stops when the job completes or is cancelled. Existing messages stay readable to participants. The UI displays the latest 100 messages and supports switching between live jobs.

The website code and Firestore rules must both be published. Publishing GitHub Pages alone does not activate Firestore access.

## Firebase rules publication

The current cloud environment has no configured Firebase administrator identity. An authorized Firebase owner must publish the reviewed rules:

1. Open https://console.firebase.google.com/project/fareride-app-0907-349/firestore/rules
2. Compare the existing rules with this repository's `firestore.rules`, preserving any intentional production changes.
3. Add the block beginning `// One shared, append-only conversation` for `/rides/{rideId}/messages/{messageId}`. It uses the existing top-level `signedIn()` and `admin()` functions. Do not replace unrelated policies with a permissive catch-all.
4. Click **Publish**. Refresh the app or choose **Reconnect chat**.

Alternatively, from an authenticated checkout with the proper Firebase access, run:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

`firestore.rules` is canonical; the same chat block is included in `firestore-towing-console.rules` for the legacy baseline. No new composite index is needed.

## Verify

Open the same assigned job in separate rider, driver and admin sessions. Send a message from each and check that it appears in the other two. Check that another driver cannot read or send messages for that job. Complete the job and confirm the chat becomes read-only. Never show a successful-send status before Firebase acknowledges the write.

Local checks:

```sh
node --test job-chat-state.test.mjs
XDG_CONFIG_HOME=/tmp/fareride-firebase-config FIREBASE_EMULATORS_PATH=/tmp/fareride-firebase-emulators tests/towing-rules/node_modules/.bin/firebase emulators:exec --only firestore --project demo-fareride --config firebase.test.json 'node --test tests/towing-rules/job-chat-rules.test.mjs'
```
