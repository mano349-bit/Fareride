# Publish the job-acceptance fix

The driver claim path for passenger and delivery jobs requires a signed-in Driver
account and a still-requested, unassigned job. It no longer requires a fresh GPS
presence record, application approval, exact application-field equality, or a
particular pricing status. Assignment cannot change the fare or other booking
fields. The transaction and Firestore rules both prevent a second driver from
claiming the same job. Cancelled and finished jobs cannot be reopened.

Offline mode still pauses new job queues and rider visibility. Towing still uses
the existing price-offer process, including agreed prices and atomic offer/ride
updates. GPS presence freshness no longer vetoes the agreed towing assignment.
Existing sign-in/role checks and other database permissions remain in place.

## Firebase publication required

Website deployment does **not** deploy Firestore rules. Publish the canonical
`firestore.rules` to project `fareride-app-0907-349` using authorized credentials:

```sh
firebase deploy --only firestore:rules --project fareride-app-0907-349
```

Alternatively open:
https://console.firebase.google.com/project/fareride-app-0907-349/firestore/databases/-default-/security/rules

Review the currently deployed rules against the complete canonical file and retain
any additional live changes before publishing. `firestore-towing-console.rules`
contains the corresponding claim fix for the older console baseline; it omits
other current policies and should not replace the canonical file by default.
Do not replace the policy with allow-all rules.

This environment has no Firebase CLI account or configured administrator identity.
Live Firebase rule deployment remains pending. Do not share passwords, OAuth codes,
or service-account private keys in chat or commit them to the repository.

## Validation

Use the existing demo-project Firestore emulator tests under `tests/towing-rules`.
They cover acceptance without an application or presence, legacy/missing pricing,
preserving fare values, competing driver claims, spoofed identity, unauthenticated
writes, cancelled jobs, and both towing negotiation participants.

After publishing live rules, refresh the driver page and accept an unassigned job.
Confirm rider and driver see the same assignment. Attempt the same job as another
driver and confirm it cannot be claimed a second time. Live review accounts and
production rules have not been tested by the local emulator.
