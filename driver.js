import {
  db,
  doc,
  collection,
  updateDoc,
  onSnapshot
} from "./firebase-config.js";

const RK = 'fareride_rides_v2';

const DRIVER_ID = 'driver_1';
const DRIVER_NAME = 'Driver 1';

const ACTIVE_RIDE_KEY =
  'fareride_active_driver_ride';

const $ = id =>
  document.getElementById(id);

let rides = [];


/* ========================================
   LOCAL BACKUP
======================================== */

function saveLocalBackup() {

  localStorage.setItem(
    RK,
    JSON.stringify(rides)
  );

}


/* ========================================
   ACTIVE DRIVER RIDE
======================================== */

function setActiveDriverRide(id) {

  if (!id) return;

  localStorage.setItem(
    ACTIVE_RIDE_KEY,
    id
  );

  if (
    window.FareRideDriverLocation
  ) {

    window
      .FareRideDriverLocation
      .setActiveRide(id);

  }

}


function clearActiveDriverRide() {

  localStorage.removeItem(
    ACTIVE_RIDE_KEY
  );

  if (
    window.FareRideDriverLocation
  ) {

    window
      .FareRideDriverLocation
      .clearActiveRide();

  }

}


/* ========================================
   MONEY
======================================== */

function money(value) {

  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD'
    }
  ).format(
    Number(value) || 0
  );

}


/* ========================================
   DRIVER MESSAGE
======================================== */

function setDriverMessage(text) {

  const msg = $('driverMsg');

  if (msg) {
    msg.textContent = text;
  }

}


/* ========================================
   RENDER RIDES
======================================== */

function renderRequests() {

  const list =
    $('requestList');

  if (!list) {
    return;
  }


  const visibleRides =
    rides.filter(
      ride => {

        /*
          Any driver can see
          a new requested ride.
        */

        if (
          ride.status ===
          'requested'
        ) {
          return true;
        }


        /*
          Driver 1 can see
          their active ride.
        */

        if (
          ride.driverId ===
            DRIVER_ID &&
          [
            'accepted',
            'arrived',
            'started'
          ].includes(
            ride.status
          )
        ) {
          return true;
        }


        return false;
      }
    );


  if (!visibleRides.length) {

    list.innerHTML = `
      <div class="card">
        <p>
          No ride requests right now.
        </p>
      </div>
    `;

    return;
  }


  list.innerHTML =
    visibleRides.map(
      ride => {

        let button = '';


        /* REQUESTED */

        if (
          ride.status ===
          'requested'
        ) {

          button = `
            <button
              class="rideAction acceptRide"
              data-id="${ride.id}">
              Accept Ride
            </button>
          `;

        }


        /* ACCEPTED */

        if (
          ride.status ===
            'accepted' &&
          ride.driverId ===
            DRIVER_ID
        ) {

          button = `
            <button
              class="rideAction arrivedRide"
              data-id="${ride.id}">
              Arrived at Pickup
            </button>
          `;

        }


        /* ARRIVED */

        if (
          ride.status ===
            'arrived' &&
          ride.driverId ===
            DRIVER_ID
        ) {

          button = `
            <button
              class="rideAction startRide"
              data-id="${ride.id}">
              Start Ride
            </button>
          `;

        }


        /* STARTED */

        if (
          ride.status ===
            'started' &&
          ride.driverId ===
            DRIVER_ID
        ) {

          button = `
            <button
              class="rideAction completeRide"
              data-id="${ride.id}">
              Complete Ride
            </button>
          `;

        }


        return `

          <div class="card">

            <h3>
              ${ride.riderName || 'Rider'}
            </h3>

            <p>
              <strong>Status:</strong>
              ${ride.status || 'requested'}
            </p>

            <p>
              <strong>Pickup:</strong>
              ${ride.pickup || ''}
            </p>

            <p>
              <strong>Destination:</strong>
              ${ride.dropoff || ''}
            </p>

            <p>
              <strong>Mileage:</strong>
              ${Number(
                ride.miles || 0
              ).toFixed(2)}
              miles
            </p>

            <p>
              <strong>Fare:</strong>
              ${money(
                ride.fare
              )}
            </p>

            ${
              ride.tipAmount
                ? `
                  <p>
                    <strong>Tip:</strong>
                    ${money(
                      ride.tipAmount
                    )}
                  </p>
                `
                : ''
            }

            ${
              ride.totalFare
                ? `
                  <p>
                    <strong>Total:</strong>
                    ${money(
                      ride.totalFare
                    )}
                  </p>
                `
                : ''
            }

            ${button}

          </div>

        `;

      }
    ).join('');


  /* ACCEPT BUTTONS */

  document
    .querySelectorAll(
      '.acceptRide'
    )
    .forEach(
      button => {

        button.onclick = () => {

          acceptRide(
            button.dataset.id
          );

        };

      }
    );


  /* ARRIVED BUTTONS */

  document
    .querySelectorAll(
      '.arrivedRide'
    )
    .forEach(
      button => {

        button.onclick = () => {

          arrivedRide(
            button.dataset.id
          );

        };

      }
    );


  /* START BUTTONS */

  document
    .querySelectorAll(
      '.startRide'
    )
    .forEach(
      button => {

        button.onclick = () => {

          startRide(
            button.dataset.id
          );

        };

      }
    );


  /* COMPLETE BUTTONS */

  document
    .querySelectorAll(
      '.completeRide'
    )
    .forEach(
      button => {

        button.onclick = () => {

          completeRide(
            button.dataset.id
          );

        };

      }
    );

}


/* ========================================
   ACCEPT RIDE
======================================== */

async function acceptRide(id) {

  const now =
    new Date()
      .toISOString();

  try {

    await updateDoc(
      doc(
        db,
        'rides',
        id
      ),
      {
        status:
          'accepted',

        driverId:
          DRIVER_ID,

        driverName:
          DRIVER_NAME,

        acceptedAt:
          now
      }
    );


    /*
      This is important for
      live GPS on the phone.
    */

    setActiveDriverRide(id);


    setDriverMessage(
      'Ride accepted — Driver 1'
    );


  } catch (error) {

    console.error(
      'Accept ride failed:',
      error
    );

    setDriverMessage(
      'Unable to accept ride.'
    );

  }

}


/* ========================================
   DRIVER ARRIVED
======================================== */

async function arrivedRide(id) {

  const now =
    new Date()
      .toISOString();

  try {

    await updateDoc(
      doc(
        db,
        'rides',
        id
      ),
      {
        status:
          'arrived',

        arrivedAt:
          now
      }
    );


    setActiveDriverRide(id);


    setDriverMessage(
      'Driver arrived at pickup'
    );


  } catch (error) {

    console.error(
      'Arrived update failed:',
      error
    );

    setDriverMessage(
      'Unable to update arrival.'
    );

  }

}


/* ========================================
   START RIDE
======================================== */

async function startRide(id) {

  const ride =
    rides.find(
      item =>
        item.id === id
    );


  if (!ride) {
    return;
  }


  const now =
    new Date()
      .toISOString();


  const estimatedFinishAt =
    new Date(
      Date.now() +
      Number(
        ride.durationMinutes ||
        0
      ) *
      60000
    ).toISOString();


  try {

    await updateDoc(
      doc(
        db,
        'rides',
        id
      ),
      {
        status:
          'started',

        startedAt:
          now,

        estimatedFinishAt:
          estimatedFinishAt
      }
    );


    setActiveDriverRide(id);


    setDriverMessage(
      'Ride started'
    );


  } catch (error) {

    console.error(
      'Start ride failed:',
      error
    );

    setDriverMessage(
      'Unable to start ride.'
    );

  }

}


/* ========================================
   COMPLETE RIDE
======================================== */

async function completeRide(id) {

  const now =
    new Date()
      .toISOString();

  try {

    await updateDoc(
      doc(
        db,
        'rides',
        id
      ),
      {
        status:
          'completed',

        completedAt:
          now
      }
    );


    /*
      Stop live GPS when
      the ride is completed.
    */

    clearActiveDriverRide();


    setDriverMessage(
      'Ride completed'
    );


  } catch (error) {

    console.error(
      'Complete ride failed:',
      error
    );

    setDriverMessage(
      'Unable to complete ride.'
    );

  }

}


/* ========================================
   LIVE FIRESTORE RIDES
======================================== */

function startRideListener() {

  const ridesCollection =
    collection(
      db,
      'rides'
    );


  onSnapshot(

    ridesCollection,


    snapshot => {

      rides =
        snapshot.docs.map(
          rideDoc => ({

            id:
              rideDoc.id,

            ...rideDoc.data()

          })
        );


      /*
        Newest rides first.
      */

      rides.sort(
        (a, b) => {

          const timeA =
            new Date(
              a.requestedAt ||
              0
            ).getTime();

          const timeB =
            new Date(
              b.requestedAt ||
              0
            ).getTime();

          return (
            timeB -
            timeA
          );

        }
      );


      saveLocalBackup();


      /*
        Restore the active ride
        after phone/browser refresh.
      */

      const activeRide =
        rides.find(
          ride =>

            ride.driverId ===
              DRIVER_ID &&

            [
              'accepted',
              'arrived',
              'started'
            ].includes(
              ride.status
            )
        );


      if (activeRide) {

        /*
          Save this immediately,
          even if driver-location.js
          has not loaded yet.
        */

        localStorage.setItem(
          ACTIVE_RIDE_KEY,
          activeRide.id
        );


        if (
          window
            .FareRideDriverLocation
        ) {

          window
            .FareRideDriverLocation
            .setActiveRide(
              activeRide.id
            );

        }

      }


      renderRequests();

    },


    error => {

      console.error(
        'Firestore ride listener failed:',
        error
      );


      const list =
        $('requestList');


      if (list) {

        list.innerHTML = `

          <div class="card">

            <p>
              Unable to load ride requests
              from Firebase.
            </p>

          </div>

        `;

      }

    }

  );

}


/* ========================================
   START
======================================== */

startRideListener();