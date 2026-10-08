# Nearby driver availability

Rider results show the nearest 10 available drivers within 20 straight-line miles, using the calculated pickup coordinates or shared GPS. Drivers must tap Go online and allow GPS. Drivers on accepted/started/arrived rides are unavailable. Updates older than 90 seconds are excluded. Only approved signed-in riders and admins can read presence records; drivers write their own validated presence record. No contact information, license images or application documents are in presence records.

Publish only the new driverPresence block from firestore.rules into the CURRENT live rules, leaving all existing rules intact. The Firebase console currently reports Error loading rules versions; do not overwrite it from a stale editor. Publication expands access to driver coordinates and requires user confirmation at action time under the browser confirmation policy.
