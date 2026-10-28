# Toll submission and admin confirmation

Drivers use **Submit toll for admin confirmation** on the dashboard or earnings page. A submission creates a pending claim in `rides/{rideId}/tollEvents/{eventId}`; it does not change rider charges, driver earnings, or receipt totals.

Active admins open **Admin → Toll approvals**, verify the actual charge against the driver's receipt or toll account, and approve or reject it. Approval updates the claim and ride aggregate in a single transaction. Repeated approvals cannot post the same claim twice. Rejections add no charge.

Approved tolls are added separately to rider totals and reimbursed 100% to the driver. FareRide's commission excludes tolls. The default one-third operating expense estimate also excludes toll reimbursements. Both receipt pages and PDF receipts use the approved ride aggregate.

## Required Firebase activation

Website deployment does not deploy database rules. An authorized administrator must publish the updated `firestore.rules` for `fareride-app-0907-349`:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

The session has no Firebase deployment credentials. Until the new rules are published, toll submission/review can be denied. Publish the latest rules even if the earlier direct-entry rules were published; the new rules remove drivers' ability to post toll charges without admin review. Test with driver, rider and admin test accounts before collecting reimbursements.

## GPS and payment scope

Automatic GPS toll detection/pricing is not configured. Drivers submit actual tolls manually. No provider account is needed for this workflow.

This updates accounting and receipts, not payment-processor charges or bank transfers. A payment integration must collect the rider total and settle the full approved toll reimbursement to the driver.

## Historical records

Existing toll aggregates are retained. Previously posted tolls are not automatically reversed. Admins should reconcile any tolls recorded before this approval workflow. Rides with older toll fields and no accounting version require admin reconciliation before new approvals. Historical driver payouts already including tolls must set `driverEarningsIncludesTolls: true` to avoid duplicate reimbursement in earnings reports.

## Tests

`node --test toll-accounting.test.mjs toll-review.test.mjs admin-financials.test.mjs driver-daily-expenses.test.mjs`

Permission tests: `firebase emulators:exec --project demo-fareride-tolls --only firestore --config firebase.tolls.test.json "node --test tests/towing-rules/toll-rules.test.mjs"`

The emulator download was blocked by the execution environment (HTTP 403); permission tests have not been run in this session.
