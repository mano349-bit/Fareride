import { vehicleIcon } from './ride-ui.js';
import {
  db,
  doc,
  onSnapshot
} from "./firebase-session.js";

const LAST = 'fareride_last_ride_id';

let map = null;
let driverMarker = null;
let pickupMarker = null;
let routeLine = null;
let unsubscribeRide = null;


/*
  Calculate straight-line distance
  between driver and pickup.
*/
function distanceMiles(
  lat1,
  lng1,
  lat2,
  lng2
) {

  const R = 3958.8;

  const toRad =
    degrees =>
      degrees * Math.PI / 180;

  const dLat =
    toRad(lat2 - lat1);

  const dLng =
    toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(
      toRad(lat1)
    ) *

    Math.cos(
      toRad(lat2)
    ) *

    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}


/*
  Temporary ETA calculation.

  For now we estimate city driving
  at about 25 MPH.

  Later we can replace this with
  real road-routing ETA.
*/
function estimateMinutes(
  miles
) {

  const averageSpeedMph = 25;

  const minutes =
    (
      miles /
      averageSpeedMph
    ) * 60;

  return Math.max(
    1,
    Math.round(minutes)
  );
}


function formatTime(date) {

  return new Date(date)
    .toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit'
      }
    );
}


function setMapStatus(text) {

  const box =
    document.getElementById(
      'driverEtaStatus'
    );

  if (box) {
    box.textContent = text;
  }
}


function initializeMap(
  pickupLocation
) {

  if (!window.L) {

    console.error(
      'Leaflet did not load.'
    );

    setMapStatus(
      'Map could not load.'
    );

    return;
  }

  if (map) {
    return;
  }

  const pickupLat =
    Number(
      pickupLocation.lat
    );

  const pickupLng =
    Number(
      pickupLocation.lng
    );

  map =
    L.map(
      'driverMap'
    ).setView(
      [
        pickupLat,
        pickupLng
      ],
      13
    );

  L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,

      attribution:
        '&copy; OpenStreetMap contributors'
    }
  ).addTo(map);


  pickupMarker =
    L.marker(
      [
        pickupLat,
        pickupLng
      ]
    )
    .addTo(map)
    .bindPopup(
      '📍 Customer pickup'
    );

}


function updateDriverMap(
  ride
) {

  const pickup =
    ride.pickupLocation;

  const driver =
    ride.driverLocation;

  if (
    !pickup ||
    pickup.lat == null ||
    pickup.lng == null
  ) {

    setMapStatus(
      'Waiting for pickup location...'
    );

    return;
  }


  initializeMap(
    pickup
  );


  if (
    !driver ||
    driver.lat == null ||
    driver.lng == null
  ) {

    setMapStatus(
      'Waiting for driver location...'
    );

    return;
  }


  const driverLat =
    Number(driver.lat);

  const driverLng =
    Number(driver.lng);

  const pickupLat =
    Number(pickup.lat);

  const pickupLng =
    Number(pickup.lng);


  /*
    Create or move Driver marker.
  */

  if (!driverMarker) {

    driverMarker =
      L.marker(
        [
          driverLat,
          driverLng
        ], {icon: L.divIcon({html: vehicleIcon(ride.serviceType), className: "fareride-map-icon", iconSize:[40,36], iconAnchor:[20,18]})})
      .addTo(map)
      .bindPopup(
        '🚗 ' +
        (
          ride.driverName ||
          'Driver'
        )
      );

  } else {

    driverMarker.setLatLng(
      [
        driverLat,
        driverLng
      ]
    );

  }


  /*
    Draw a simple line between
    driver and pickup.
  */

  if (routeLine) {
    routeLine.remove();
  }

  routeLine =
    L.polyline(
      [
        [
          driverLat,
          driverLng
        ],

        [
          pickupLat,
          pickupLng
        ]
      ]
    )
    .addTo(map);


  const bounds =
    L.latLngBounds(
      [
        [
          driverLat,
          driverLng
        ],

        [
          pickupLat,
          pickupLng
        ]
      ]
    );

  map.fitBounds(
    bounds,
    {
      padding: [50, 50]
    }
  );


  /*
    Calculate current approximate ETA.
  */

  const miles =
    distanceMiles(
      driverLat,
      driverLng,
      pickupLat,
      pickupLng
    );

  const etaMinutes =
    estimateMinutes(
      miles
    );

  const etaTime =
    new Date(
      Date.now() +
      etaMinutes *
      60000
    );


  const distanceBox =
    document.getElementById(
      'driverDistance'
    );

  const minutesBox =
    document.getElementById(
      'driverEtaMinutes'
    );

  const arrivalBox =
    document.getElementById(
      'driverEtaTime'
    );


  if (distanceBox) {

    distanceBox.textContent =
      miles.toFixed(1) +
      ' miles';

  }


  if (minutesBox) {

    minutesBox.textContent =
      etaMinutes +
      ' min';

  }


  if (arrivalBox) {

    arrivalBox.textContent =
      formatTime(
        etaTime
      );

  }


  setMapStatus(
    '● Driver location is live'
  );
}


function watchCurrentRide() {

  const rideId =
    localStorage.getItem(
      LAST
    );


  if (!rideId) {

    setMapStatus(
      'Request a ride to see the driver map.'
    );

    return;
  }


  if (unsubscribeRide) {

    unsubscribeRide();

    unsubscribeRide = null;

  }


  unsubscribeRide =
    onSnapshot(

      doc(
        db,
        'rides',
        rideId
      ),

      snapshot => {

        if (
          !snapshot.exists()
        ) {

          setMapStatus(
            'Waiting for ride information...'
          );

          return;
        }


        const ride = {

          id: snapshot.id,

          ...snapshot.data()

        };


        /*
          Only show live location after
          a driver has accepted the ride.
        */

        if (
          ride.status ===
          'requested'
        ) {

          setMapStatus(
            'Waiting for a driver to accept your ride.'
          );

          return;
        }


        if (
          ride.status ===
          'cancelled'
        ) {

          setMapStatus(
            'Ride cancelled.'
          );

          return;
        }


        if (
          ride.status ===
          'completed'
        ) {

          setMapStatus(
            '✅ Ride completed'
          );

          return;
        }


        updateDriverMap(
          ride
        );

      },

      error => {

        console.error(
          'FareRide map listener error:',
          error
        );

        setMapStatus(
          'Unable to receive driver location.'
        );

      }

    );

}


window.addEventListener(
  'fareride-new-ride',
  watchCurrentRide
);


window.addEventListener(
  'storage',
  event => {

    if (
      event.key === LAST
    ) {

      watchCurrentRide();

    }

  }
);


watchCurrentRide();
