# FareRide receipt tax

This update targets the Firebase/GitHub FareRide application, not the separate older FairRide Sites project.

Open Driver → Receipts and expand a completed ride without recorded tax. The editor selects the state from saved pickup coordinates and checks saved rider/driver coordinates for disagreement. If pickup GPS is missing or reverse geocoding fails, select a state manually. GPS permission is not requested on a receipt and present-day coordinates are not used to reconstruct an old pickup.

All 50 states, DC and Outside USA are supported. The state-rate calculation defaults now come directly from the user-uploaded 2026-Sales-Tax-Data.xlsx (January 1, 2026), with all 50 states and DC imported into sales-tax-data.js. Local averages are retained for reference and are not applied as exact local rates. Selecting a state automatically populates its state rate and calculates a tax preview in both rider and driver receipts/PDFs. Table calculations are explicitly labeled unrecorded/uncollected until verified and saved; they do not change historical payments. These general state rates are not verified passenger-transport tax rates. Separate sourced TNC guidance is provided for Louisiana, New York, Connecticut and Nevada. These rules can require local fees, destination checks, specific taxable bases, and different treatment for taxis, towing or deliveries. The operator must verify the full applicable rate and obtain rider agreement before saving. No nationwide automatic tax compliance engine is claimed. Unsupported ride rules remain unrecorded rather than being treated as zero. Outside-USA entries retain the ride's existing USD currency.

Taxable amount × rate / 100 + fixed fee is rounded once to cents and saved atomically on the ride. Both participants see the same saved tax on the receipt, PDF and total. Taxes do not increase driver earnings. Legacy tax amounts are preserved without assuming whether they were already included in totalFare. Existing tax records cannot be overwritten by a driver; corrections require Admin review.

## Sources (researched November 6, 2026)

- All-state general reference, July 1, 2026: https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/
- Exact Minnesota rate: https://www.revenue.state.mn.us/so/node/9576
- Exact Missouri rate: https://dor.mo.gov/taxation/business/tax-types/sales-use/
- Exact New Jersey rate: https://www.nj.gov/treasury/taxation/businesses/salestax/
- Exact New Mexico rate: https://www.tax.newmexico.gov/businesses/wp-content/uploads/sites/4/2022/12/FYI-105.pdf
- Louisiana state/local TNC assessments: https://www.legis.la.gov/legis/Law.aspx?d=1148463
- New York assessment and geographic limits: https://www.tax.ny.gov/bus/tnc/assessment.htm
- Connecticut fixed per-trip fee: https://portal.ct.gov/drs/taxes/transportation-network-co/tax-information
- Nevada taxable total fare: https://www.leg.state.nv.us/nrs/NRS-372B.html

## Deployment

Deploy BOTH the changed static files and firestore.rules to the existing Firebase project. Hosting alone will show the editor but tax saves will be rejected until the rules are updated. Keep the existing project identity. Use Firebase CLI with the authorized project owner's account; this workspace has no Firebase credentials configured. No production records were modified during implementation.

Checks: node --test --test-isolation=none ride-tax.test.mjs toll-accounting.test.mjs receipt-toll-items.test.mjs admin-financials.test.mjs

## Validation result

19 focused tests pass, including every imported state rate and the visible receipt preview. Full suite: 268 passed, 14 failed; unchanged baseline: 261 passed, the same 14 failed. Firestore permission tests could not run because the emulator JAR download returned HTTP 403 Domain forbidden. Browser verification was unavailable.

The update is not live. Deploy both hosting and rules to project fareride-app-0907-349 using its authorized owner account.

## Authentication verified

Firebase CLI login:list reports no authorized accounts. The connected GitHub tool can read the repository. Firebase deployment is blocked until the owner signs in or configures authorized deployment credentials. Signing into Firebase Console alone does not authorize this workspace CLI.
