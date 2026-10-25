# Two-sided towing acceptance

- A rider can accept a driver's pending price.
- A driver can accept that rider's counteroffer directly.
- A participant cannot accept their own proposed price on behalf of the other person.
- Acceptance atomically assigns the driver, sets the agreed fare and tip, and marks the offer accepted.
- The assigned driver then uses the existing Start Ride → Arrive at Pickup → Complete Ride controls.

## Firebase rollout

Deploy the updated Firestore rules before enabling the new website version. Existing rider acceptance remains compatible with the update.

From an authenticated checkout:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

Or open the project's Firestore Rules tab:
https://console.firebase.google.com/u/1/project/fareride-app-0907-349/firestore/databases/-default-/security/rules

Replace the editor with the complete contents of `firestore.rules` from this change and click **Publish**. This is the repository's full current policy; the towing change only adds the driver's counteroffer-acceptance path and keeps assignment/price/identity checks. Do not replace rules with a short allow-all policy. If your deployed rules contain additional custom changes not represented in this repository, retain them when applying this update.

`firestore-towing-console.rules` also contains the targeted acceptance change for the legacy console baseline; it intentionally does not add unrelated newer availability policies. Prefer the current canonical `firestore.rules` for this repository's current app.

## Validation

- Offer-state tests cover both participants, counter prices, tips, stale versions and closed jobs.
- Driver-action tests cover the accepted tow lifecycle and ownership.
- Offline browser validation exercises the actual driver and towing modules on rider/driver pages, including both acceptance paths and the complete driver lifecycle.
- The GitHub Actions workflow runs security rules in a local Firestore emulator with the fake `demo-fareride` project. It does not deploy rules or use production data/credentials.
- Emulator coverage includes valid rider/driver acceptance, rejected self-acceptance/foreign participants, atomicity, changed prices/identity/tips, offline/suspended drivers, stale offers, competing drivers, and lifecycle transitions.
