# Automatic online and location availability

Drivers become online automatically after Driver sign-in and remain online until
logout. There is no Go online/Go offline or Start/Stop Location control. A current
trip, missing GPS, or failed presence update does not disable the job queue.
Connection errors are reported separately from the signed-in online state.

A single `session-location.js` GPS controller starts for signed-in rider and driver
pages. It shares location automatically with an assigned active trip, supplies
nearby-driver presence, and provides local rider position before a trip starts.
It clears GPS on logout/page exit and resumes on return, reconnection, or a site
permission change. It retries temporary GPS errors without a manual toggle.

GPS requires device/site permission and an available connection. Web browsers and
the Android WebView can suspend location when the app is closed or backgrounded;
this implementation does not provide a native background location service.
Locations that are not refreshed expire from nearby-driver results within 90
seconds. Drivers with active trips are hidden from nearby-driver results while
remaining online for jobs. Only approved riders/admins can read presence records.

Deploy the changed web files together, including `session-location.js` and
`driver-control-state.js`. Publish the prepared Firestore changes separately from
the website. Preserve any additional live policy changes when merging the current
canonical `firestore.rules`. This environment has no Firebase administrator
connection; local emulator tests do not establish production rule publication.

Validate with signed-in rider and driver accounts: verify automatic online state,
no manual location toggles, location permission recovery, job claim by one driver,
rejection of competing claims, and automatic GPS through accepted/started/arrived
trip stages. Signing out should stop sharing and remove nearby-driver presence;
failed or disconnected cleanup still relies on the 90-second freshness limit.
