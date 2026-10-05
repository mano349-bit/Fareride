import { auth, getDoc, onAuthStateChanged } from './firebase-config.js';
/* FareRide mobile GPS tuning:
   - Longer timeout for cellular GPS acquisition
   - Allows a recent cached fix while a fresh GPS fix is obtained
*/
import {
  db,
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp
} from "./firebase-config.js";


const ACTIVE_RIDE_KEY =
  "fareride_active_driver_ride";

const currentDriverId = () => auth.currentUser?.uid;

const currentDriverName = () => auth.currentUser?.displayName || 'Driver';


let watchId = null;
let lastSentAt = 0;


/* =========================================================
   ACTIVE RIDE
========================================================= */

function getActiveRideId() {

  return localStorage.getItem(
    ACTIVE_RIDE_KEY
  );

}


/* =========================================================
   LOCATION MESSAGE
========================================================= */

function setLocationMessage(
  text,
  error = false
) {

  const box =
    document.getElementById(
      "locationStatus"
    );

  if (!box) {
    return;
  }

  box.textContent = text;

  box.style.color =
    error
      ? "#b42318"
      : "#08783d";

}


/* =========================================================
   NORMAL DRIVER LOCATION
========================================================= */

async function saveDriverLocation(
  position
) {

  const rideId =
    getActiveRideId();

  if (!rideId) {

    setLocationMessage(
      "No active ride selected.",
      true
    );

    return;
  }


  const now =
    Date.now();


  // Prevent excessive Firestore writes.
  if (
    now - lastSentAt <
    5000
  ) {

    return;
  }


  if (!auth.currentUser) return;
  const active = await getDoc(doc(db, 'rides', rideId)).catch(() => null);
  if (!active?.exists() || active.data().driverId !== auth.currentUser.uid
      || !['accepted', 'arrived', 'started'].includes(active.data().status)) {
    stopDriverLocationTracking(); return;
  }
  lastSentAt = now;


  const {
    latitude,
    longitude,
    accuracy,
    heading,
    speed
  } = position.coords;


  try {

    await updateDoc(
      doc(
        db,
        "rides",
        rideId
      ),
      {

        driverLocation: {

          lat:
            latitude,

          lng:
            longitude,

          accuracy:
            Number(
              accuracy || 0
            ),

          heading:
            heading == null
              ? null
              : Number(
                  heading
                ),

          speed:
            speed == null
              ? null
              : Number(
                  speed
                )

        },

        driverLocationUpdatedAt:
          serverTimestamp()

      }
    );


    setLocationMessage(
      "â— Live location active"
    );


    window.dispatchEvent(
      new CustomEvent(
        "fareride-driver-location",
        {
          detail: {
            lat:
              latitude,
            lng:
              longitude
          }
        }
      )
    );


  } catch (error) {

    console.error(
      "FareRide location update failed:",
      error
    );


    setLocationMessage(
      "Location could not be sent to FareRide.",
      true
    );

  }

}


/* =========================================================
   NORMAL LOCATION ERROR
========================================================= */

function locationError(
  error
) {

  let message =
    "Unable to access driver location.";


  if (error.code === 1) {

    message =
      "Location permission was denied.";

  }


  if (error.code === 2) {

    message =
      "Driver location is unavailable.";

  }


  if (error.code === 3) {

    message =
      "Driver location request timed out.";

  }


  setLocationMessage(
    message,
    true
  );

}


/* =========================================================
   START LIVE LOCATION
========================================================= */

function startDriverLocationTracking() {

  if (
    !navigator.geolocation
  ) {

    setLocationMessage(
      "This device does not support GPS location.",
      true
    );

    return;

  }


  if (
    !getActiveRideId()
  ) {

    setLocationMessage(
      "Accept a ride before starting location sharing.",
      true
    );

    return;

  }


  if (
    watchId !== null
  ) {

    return;

  }


  setLocationMessage(
    "Starting live location..."
  );


  watchId =
    navigator.geolocation
      .watchPosition(

        saveDriverLocation,

        locationError,

        {
          enableHighAccuracy:
            true,

          maximumAge: 10000,

          timeout: 60000
        }

      );

}


/* =========================================================
   STOP LIVE LOCATION
========================================================= */

function stopDriverLocationTracking() {

  if (
    watchId !== null
  ) {

    navigator.geolocation
      .clearWatch(
        watchId
      );

    watchId = null;

  }


  setLocationMessage(
    "Location sharing stopped."
  );

}


/* =========================================================
   SOS DISPLAY
========================================================= */

function showEmergencyResult(
  latitude,
  longitude
) {

  const box =
    document.getElementById(
      "sosResult"
    );


  if (!box) {
    return;
  }


  const mapUrl =
    "https://www.google.com/maps?q=" +
    encodeURIComponent(
      latitude +
      "," +
      longitude
    );


  box.innerHTML = `

    <div class="sos-success">

      <strong>
        ðŸš¨ SOS SENT TO FARERIDE
      </strong>

      <br><br>

      Your emergency location was recorded.

      <br><br>

      <strong>
        Latitude:
      </strong>
      ${latitude.toFixed(6)}

      <br>

      <strong>
        Longitude:
      </strong>
      ${longitude.toFixed(6)}

      <br><br>

      <a
        class="sos-map-link"
        href="${mapUrl}"
        target="_blank"
        rel="noopener">

        ðŸ“ View My Location

      </a>

      <br><br>

      <a
        class="call-911-button"
        href="tel:911">

        ðŸ“ž CALL 911 NOW

      </a>

    </div>

  `;

}


/* =========================================================
   EMERGENCY SOS
========================================================= */

async function sendEmergencySOS() {

  const confirmed =
    window.confirm(
      "EMERGENCY SOS\n\n" +
      "This will send your current GPS location " +
      "to FareRide and mark an emergency.\n\n" +
      "Continue?"
    );


  if (!confirmed) {
    return;
  }


  const resultBox =
    document.getElementById(
      "sosResult"
    );


  if (resultBox) {

    resultBox.innerHTML =
      "Getting your emergency GPS location...";

  }


  if (
    !navigator.geolocation
  ) {

    if (resultBox) {

      resultBox.innerHTML =
        "GPS location is not supported on this device.";

    }

    return;

  }


  navigator.geolocation
    .getCurrentPosition(

      async position => {

        const {
          latitude,
          longitude,
          accuracy
        } = position.coords;


        const rideId =
          getActiveRideId();


        try {

          /*
            Create permanent emergency record.
          */

          const emergency =
            await addDoc(
              collection(
                db,
                "emergencies"
              ),
              {

                type:
                  "SOS",

                source:
                  "driver",

                driverId:
                  currentDriverId(),

                driverName:
                  currentDriverName(),

                rideId:
                  rideId || null,

                status:
                  "active",

                latitude:
                  latitude,

                longitude:
                  longitude,

                accuracy:
                  Number(
                    accuracy || 0
                  ),

                mapUrl:
                  "https://www.google.com/maps?q=" +
                  latitude +
                  "," +
                  longitude,

                createdAt:
                  serverTimestamp()

              }
            );


          /*
            Also mark the active ride
            as having an emergency.
          */

          if (rideId) {

            await updateDoc(
              doc(
                db,
                "rides",
                rideId
              ),
              {

                emergencyActive:
                  true,

                emergencyId:
                  emergency.id,

                emergencySource:
                  "driver",

                emergencyLocation: {

                  lat:
                    latitude,

                  lng:
                    longitude,

                  accuracy:
                    Number(
                      accuracy || 0
                    )

                },

                emergencyAt:
                  serverTimestamp()

              }
            );

          }


          console.log(
            "FareRide SOS sent:",
            emergency.id
          );


          showEmergencyResult(
            latitude,
            longitude
          );


        } catch (error) {

          console.error(
            "FareRide SOS failed:",
            error
          );


          if (resultBox) {

            resultBox.innerHTML =
              "âš ï¸ SOS could not be sent to FareRide. " +
              "Call 911 immediately if you are in danger.";

          }

        }

      },


      error => {

        console.error(
          "Emergency GPS failed:",
          error
        );


        if (resultBox) {

          resultBox.innerHTML =
            "âš ï¸ FareRide could not get your GPS location. " +
            "Call 911 immediately if you are in danger.";

        }

      },


      {
        enableHighAccuracy:
          true,

        maximumAge:
          0,

        timeout: 60000
      }

    );

}


/* =========================================================
   PUBLIC DRIVER LOCATION API
========================================================= */

window.FareRideDriverLocation = {

  start:
    startDriverLocationTracking,

  stop:
    stopDriverLocationTracking,

  sos:
    sendEmergencySOS,


  setActiveRide(
    rideId
  ) {

    localStorage.setItem(
      ACTIVE_RIDE_KEY,
      rideId
    );

  },


  clearActiveRide() {

    localStorage.removeItem(
      ACTIVE_RIDE_KEY
    );

    stopDriverLocationTracking();

  }

};

onAuthStateChanged(auth, () => stopDriverLocationTracking());
