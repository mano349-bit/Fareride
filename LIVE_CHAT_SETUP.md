# Rider–driver chat rollout

Publish the complete firestore.rules from this branch in the fareride-app-0907-349 Firebase Console before merging this change. Chat lives at rides/{rideId}/messages; approved matched participants and Admin can read. Only assigned participants can send during accepted/started/arrived stages. Messages are immutable; completed/cancelled conversations remain read-only. No existing towing-offer permissions are weakened.

The completed-ride driverComment field can also be saved by the owning rider without selecting a star rating; only that field may change through the added permission.

Console: https://console.firebase.google.com/u/1/project/fareride-app-0907-349/firestore/databases/-default-/security/rules

Local command from an authenticated checkout:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

The two-page browser fixture verified bidirectional live delivery, assigned-job selection, preserved drafts, safe message text, completion and sign-out cleanup. GitHub Actions runs both existing towing rules and new chat/comment permission tests against the fake demo-fareride project; no production data or credentials are used.
