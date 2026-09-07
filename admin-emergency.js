import {
  db,
  auth,
  collection,
  doc,
  updateDoc,
  onSnapshot,
  onAuthStateChanged,
  serverTimestamp
} from "./firebase-config.js";


let emergencies = [];
let stopEmergencyListener = null;


const $ = id =>
  document.getElementById(id);


/* =========================================================
   DATE
========================================================= */

function emergencyDate(value) {

  if (!value) {
    return "—";
  }

  if (
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {

    return value
      .toDate()
      .toLocaleString();

  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }

  return date.toLocaleString();

}


/* =========================================================
   SAFE TEXT
========================================================= */

function safe(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   MAP URL
========================================================= */

function getMapUrl(item) {

  if (item.mapUrl) {
    return item.mapUrl;
  }

  if (
    item.latitude != null &&
    item.longitude != null
  ) {

    return (
      "https://www.google.com/maps?q=" +
      encodeURIComponent(
        item.latitude +
        "," +
        item.longitude
      )
    );

  }

  return "#";

}


/* =========================================================
   ACTIVE SOS COUNT
========================================================= */

function activeSOS() {

  return emergencies.filter(
    item =>
      item.status !== "resolved"
  );

}


/* =========================================================
   TOP EMERGENCY BANNER
========================================================= */

function renderEmergencyBanner() {

  const banner =
    $("emergencyTopBanner");

  const count =
    $("emergencyCount");

  if (!banner) {
    return;
  }


  const active =
    activeSOS();


  if (count) {

    count.textContent =
      active.length;

  }


  if (!active.length) {

    banner.classList.add(
      "hidden"
    );

    return;

  }


  const newest =
    active[0];


  banner.classList.remove(
    "hidden"
  );


  $("emergencyBannerSource")
    .textContent =
      (
        newest.source ||
        "unknown"
      ).toUpperCase();


  $("emergencyBannerRide")
    .textContent =
      newest.rideId ||
      "No active ride";


  $("emergencyBannerTime")
    .textContent =
      emergencyDate(
        newest.createdAt
      );


  const mapButton =
    $("emergencyBannerMap");


  mapButton.href =
    getMapUrl(newest);

}


/* =========================================================
   EMERGENCY CARDS
========================================================= */

function renderEmergencyList() {

  const list =
    $("emergencyList");

  if (!list) {
    return;
  }


  if (!emergencies.length) {

    list.innerHTML = `
      <div class="empty">
        No SOS emergencies have been recorded.
      </div>
    `;

    return;

  }


  list.innerHTML =
    emergencies
      .map(
        item => {

          const status =
            item.status ||
            "active";

          const source =
            (
              item.source ||
              "unknown"
            ).toUpperCase();


          const lat =
            item.latitude == null
              ? "—"
              : Number(
                  item.latitude
                ).toFixed(6);


          const lng =
            item.longitude == null
              ? "—"
              : Number(
                  item.longitude
                ).toFixed(6);


          const mapUrl =
            getMapUrl(item);


          return `

            <div class="
              emergency-admin-card
              emergency-status-${safe(status)}
            ">

              <div class="emergency-card-header">

                <div>

                  <div class="emergency-source">
                    🚨 ${safe(source)} SOS
                  </div>

                  <div class="emergency-status">
                    ${safe(status)}
                  </div>

                </div>

                <div class="emergency-time">
                  ${safe(
                    emergencyDate(
                      item.createdAt
                    )
                  )}
                </div>

              </div>


              <div class="emergency-info-grid">

                <div>
                  <strong>Emergency ID</strong>
                  <span>${safe(item.id)}</span>
                </div>

                <div>
                  <strong>Ride ID</strong>
                  <span>${safe(item.rideId || "—")}</span>
                </div>

                <div>
                  <strong>Driver</strong>
                  <span>
                    ${safe(
                      item.driverName ||
                      item.driverId ||
                      "—"
                    )}
                  </span>
                </div>

                <div>
                  <strong>Latitude</strong>
                  <span>${lat}</span>
                </div>

                <div>
                  <strong>Longitude</strong>
                  <span>${lng}</span>
                </div>

                <div>
                  <strong>Accuracy</strong>
                  <span>
                    ${
                      item.accuracy == null
                        ? "—"
                        : safe(
                            Math.round(
                              Number(
                                item.accuracy
                              )
                            ) + " meters"
                          )
                    }
                  </span>
                </div>

              </div>


              <div class="emergency-buttons">

                <a
                  href="${safe(mapUrl)}"
                  target="_blank"
                  rel="noopener"
                  class="emergency-map-btn">

                  📍 Open Emergency Location

                </a>


                ${
                  status === "active"
                    ? `
                      <button
                        type="button"
                        class="emergency-ack-btn"
                        data-emergency-ack="${safe(item.id)}">

                        ✓ Acknowledge

                      </button>
                    `
                    : ""
                }


                ${
                  status !== "resolved"
                    ? `
                      <button
                        type="button"
                        class="emergency-resolve-btn"
                        data-emergency-resolve="${safe(item.id)}">

                        ✓ Emergency Resolved

                      </button>
                    `
                    : ""
                }

              </div>

            </div>

          `;

        }
      )
      .join("");


  document
    .querySelectorAll(
      "[data-emergency-ack]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            acknowledgeEmergency(
              button.dataset
                .emergencyAck
            );

      }
    );


  document
    .querySelectorAll(
      "[data-emergency-resolve]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            resolveEmergency(
              button.dataset
                .emergencyResolve
            );

      }
    );

}


/* =========================================================
   ACKNOWLEDGE
========================================================= */

async function acknowledgeEmergency(id) {

  try {

    await updateDoc(
      doc(
        db,
        "emergencies",
        id
      ),
      {

        status:
          "acknowledged",

        acknowledgedAt:
          serverTimestamp()

      }
    );

  } catch (error) {

    console.error(
      "Unable to acknowledge SOS:",
      error
    );

    alert(
      "Unable to acknowledge this emergency."
    );

  }

}


/* =========================================================
   RESOLVE
========================================================= */

async function resolveEmergency(id) {

  const confirmed =
    confirm(
      "Mark this emergency as resolved?"
    );


  if (!confirmed) {
    return;
  }


  try {

    await updateDoc(
      doc(
        db,
        "emergencies",
        id
      ),
      {

        status:
          "resolved",

        resolvedAt:
          serverTimestamp()

      }
    );

  } catch (error) {

    console.error(
      "Unable to resolve SOS:",
      error
    );

    alert(
      "Unable to mark this emergency as resolved."
    );

  }

}


/* =========================================================
   LIVE EMERGENCY LISTENER
========================================================= */

function startEmergencyListener() {

  if (stopEmergencyListener) {

    stopEmergencyListener();

    stopEmergencyListener =
      null;

  }


  stopEmergencyListener =
    onSnapshot(

      collection(
        db,
        "emergencies"
      ),

      snapshot => {

        emergencies =
          snapshot.docs
            .map(
              item => ({
                id:
                  item.id,

                ...item.data()
              })
            );


        emergencies.sort(
          (a, b) => {

            const aTime =
              a.createdAt &&
              typeof a.createdAt.toMillis === "function"
                ? a.createdAt.toMillis()
                : 0;


            const bTime =
              b.createdAt &&
              typeof b.createdAt.toMillis === "function"
                ? b.createdAt.toMillis()
                : 0;


            return (
              bTime -
              aTime
            );

          }
        );


        renderEmergencyBanner();

        renderEmergencyList();

      },


      error => {

        console.error(
          "Emergency listener failed:",
          error
        );

      }

    );

}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
  auth,
  user => {

    if (user) {

      startEmergencyListener();

    } else {

      if (stopEmergencyListener) {

        stopEmergencyListener();

        stopEmergencyListener =
          null;

      }


      emergencies = [];

      renderEmergencyBanner();

      renderEmergencyList();

    }

  }
);
