# Agreed tolls

The driver and customer agree on the toll amount. In **Record a toll**, the driver chooses the ride, enters the toll road/booth and agreed amount, checks **The customer and I agreed to this toll amount**, then selects **Add agreed toll to ride total**.

No admin approval or toll provider is required. The checkbox records the driver's confirmation of the customer agreement; it is not a separate electronic approval submitted by the rider.

The rider total and both receipt pages/PDFs include the agreed toll. The driver receives 100% of that amount. FareRide takes no commission on tolls, and default operating expense estimates exclude toll reimbursement.

## Required database activation

Publish the latest `firestore.rules` in Firebase project `fareride-app-0907-349`. GitHub Pages deployment does not publish database rules, and this session has no Firebase deployment credentials:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

The rules require the customer's agreement to be recorded, the assigned driver to be signed in, and a matching audit event and aggregate update in the same transaction. Publish this latest version even if older direct-entry or admin-review rules were previously published. Failed writes do not add charges.

## Accounting and history

Tolls are stored separately from the existing `totalFare` under `tollsAmount` and `tollAccounting: separate-v1`; displayed totals add them exactly once. Retry attempts reuse the same event ID. Each separate crossing needs a separate entry. The driver cannot edit/delete posted events. Corrections require admin reconciliation.

Older records with existing tolls and no accounting version require admin reconciliation. Driver payouts already including tolls must set `driverEarningsIncludesTolls: true` to avoid double reimbursement. Any pending claims from the superseded admin-review workflow are not automatically charged.

This feature updates accounting and receipts; it does not execute card charges or bank transfers. Automatic GPS detection/pricing is not connected.

## Validation

Accounting regression tests: `node --test toll-accounting.test.mjs admin-financials.test.mjs driver-daily-expenses.test.mjs`.

Permission tests: `firebase emulators:exec --project demo-fareride-tolls --only firestore --config firebase.tolls.test.json "node --test tests/towing-rules/toll-rules.test.mjs"`.

The emulator download was blocked (HTTP 403), so permission tests have not been run in this session.
