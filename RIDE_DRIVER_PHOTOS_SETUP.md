# Rider access to driver and vehicle photos

After a driver accepts a job, the driver dashboard privately shares a small photo record for that job. The rider sees:

- A — Front Image of Vehicle, with the plate number.
- B — Face Image (Passport-Style Photo).

The record includes only the two images, plate number and driver UID. License, insurance, vehicle registration and the rest of the application stay private. Rider read access ends when the job is completed or cancelled. Photos do not appear before a driver has accepted the job. Existing drivers need both photos saved in their driver application.

## Required Firebase step

These are **Cloud Firestore rules**, separate from the **Storage rules** already published for application uploads.

1. Open https://console.firebase.google.com/project/fareride-app-0907-349/firestore/rules.
2. Publish the repository's `firestore.rules`. If you have additional rules outside this repository, preserve them and add the `match /rideDriverPhotos/{rideId}` block inside `match /databases/{database}/documents` instead.
3. Keep `storage.rules` in Storage; do not paste Firestore rules into Storage.
4. Reload both the driver and rider dashboards. Book and accept a job using a driver with both photos. Check the photos appear, then complete or cancel the job and check they disappear.

Website deployment does not deploy Firebase rules. The photo share runs separately from ride acceptance, so waiting for rules publication cannot block the driver from accepting jobs. Until Firestore rules are published, photo sharing shows a permission message.

The photo records remain available to active administrators for review; rider access expires at the end of the job.
