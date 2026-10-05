# FareRide service expansion

Local branch: `feature/multi-service`, based on `origin/restore-live-site`.

The rider can choose passenger rides, towing, or bike messenger delivery. Tow requests collect vehicle and towing reason; deliveries collect package description and recipient name. Both collect pickup and destination addresses. New records stay in the existing `rides` collection with `serviceType`, `serviceDetails`, and `pricingStatus`, so the existing status, map and SOS modules remain available. Older records default to passenger rides.

Tow and messenger jobs currently request a quote. They have no invented price, route distance, or arrival time, and are withheld from provider acceptance until dispatch confirms pricing. Admin sees and can search the service and request details. The provider screen has separate service queues. This selector is a queue filter, not authorization or evidence of provider qualification.

## Verification

Run `node --test services.test.mjs`. Tests cover legacy ride compatibility, required service details, authenticated request identity, quote pricing, invalidation after editing, and failed Firebase submissions.

## Work needed for a live launch

- Implement admin quote creation, rider quote acceptance, and approved provider service capabilities enforced by backend rules.
- Replace the existing hardcoded driver identity with the signed-in driver's UID throughout dispatch, location and status handling; use transactional acceptance to prevent two providers accepting the same job.
- Verify the deployed Firestore rules. The checked-in `firestore.rules` denies all ride access and is not a working production ruleset. Do not deploy it over a working backend.
- Add an appropriate cycling route provider for messenger estimates; the existing route service is a driving route service.
- Integrate payment authorization/capture and provider payouts with server validation of prices.
- Verify booking, location sharing and SOS using authorized test accounts and test records. No real SOS was sent during development.

No remote branch, website, Firebase configuration or database has been changed by this local expansion.
