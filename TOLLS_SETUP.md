# Toll reimbursement

Confirmed tolls use separate accounting: the saved `totalFare` continues to represent the existing fare/tip charge, while `tollsAmount` is added once to the displayed rider total. `tollAccounting: separate-v1` identifies this convention. FareRide takes no commission on tolls; driver earnings add the full toll reimbursement. Default operating expenses exclude toll reimbursements.

Drivers record actual charges in **Record a toll** on the driver dashboard or earnings page. Every entry creates an immutable `rides/{rideId}/tollEvents/{eventId}` record and updates the ride aggregate in one transaction. Retries reuse the same event ID. Each separate crossing requires a separate submission. Incorrect confirmed entries require admin reconciliation; drivers cannot edit/delete the audit events.

## Required activation

The website deployment does not deploy Firestore security rules. An authorized Firebase project administrator must publish this repository's updated `firestore.rules` for project `fareride-app-0907-349` before toll entry works. Use Firebase Console → Firestore Database → Rules, or deploy with the Firebase CLI from an authenticated environment:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

Test with driver and rider test accounts before collecting real toll reimbursements. A denied write displays an error and does not charge the rider.

## Automatic GPS detection

No toll location or pricing provider is connected. GPS detection and automatic pricing are not active; drivers must confirm actual charges. Provider credentials must be kept server-side. Connecting a provider also requires vehicle/axle/tag data, direction/time-aware rate lookup, crossing deduplication, and a backend to verify confirmed charges.

## Historical data and payment integration

Rides with older toll fields and no accounting version are not automatically migrated, because their total may already include tolls. Admin reconciliation is required before adding new toll entries to those rides. Recorded `driverEarnings` are treated as excluding tolls unless `driverEarningsIncludesTolls` is explicitly true. Set that flag for any externally recorded payout already including toll reimbursement.

This change updates charge and earnings records and receipts. It does not execute card charges or bank payouts. Any payment processor integration must collect `riderTotal(ride)` and settle the full toll amount to the driver.

## Validation

Accounting regression tests: `node --test toll-accounting.test.mjs admin-financials.test.mjs driver-daily-expenses.test.mjs`.

Firestore emulator tests are in `tests/towing-rules/toll-rules.test.mjs` and require the emulator. They cover ownership, atomic writes, aggregate tampering, invalid currency values, immutable events, and replay prevention.

Run them with: `firebase emulators:exec --project demo-fareride-tolls --only firestore --config firebase.tolls.test.json "node --test tests/towing-rules/toll-rules.test.mjs"`. The emulator download was blocked by the execution environment (HTTP 403), so these permission tests have not been run in this session.
