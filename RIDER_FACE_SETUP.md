# Show the rider's face to the assigned driver

The driver sees only a confirmed square portrait cropped from the rider's own license or ID. The full ID, document text, name, address and ID number are not copied into the job's photo record.

## Rider setup

1. Sign in to the Rider dashboard and open **My face photo for the driver**.
2. Select **Open my saved license / ID**, or choose an image/PDF of the same ID from the device if the saved file cannot load.
3. Position the square over the face using dragging or the sliders. Check the zoomed face-only preview. PDF preview uses the first page; choose an image of the front if the face is on another page.
4. Confirm that the crop contains only the face and save it. The source document is processed in the rider's browser; only the confirmed JPEG crop is saved by this feature.

The rider's dashboard automatically shares the crop once a job is accepted. The driver dashboard displays the portrait during accepted, started and arrived stages, then clears it when the job is completed or cancelled. The rider should keep FareRide open so the job and crop can synchronize.

Automatic face positioning is used only when the browser supplies native face detection. Riders can always position and confirm the crop manually. This feature does not verify identity or compare faces.

## Publish the new Cloud Firestore rules

The two new collections need Firebase rule publication:

- `riderFaceProfiles/<riderUid>`: only the rider and an active administrator can read the saved crop; approved/active riders can save their own crop.
- `riderFacePhotos/<rideId>`: only active job participants and active administrators can fetch the shared crop. Only the assigned approved/active rider can write it, and the image must match their saved crop.

Open https://console.firebase.google.com/project/fareride-app-0907-349/firestore/rules, publish the repository's updated `firestore.rules`, and reload both dashboards. If you have additional custom rules outside the repository, preserve them and add the two dedicated rider face collection blocks inside `match /databases/{database}/documents`.

Keep Firebase Storage rules unchanged. Drivers cannot fetch rider face profiles, rider application records or ID documents with these permissions. Website deployment does not publish Firebase rules.

## Validation

CI runs crop bounds/confirmation/payload checks, active-job driver display and rider publication lifecycle tests, plus Firestore emulator tests for owner/driver isolation, canonical crops, private field rejection and access expiry. Physical device camera/file access, visual face placement and PDF viewing should also be checked on the target rider device.
