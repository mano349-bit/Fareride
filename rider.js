import { SERVICES, validateServiceDetails, priceLabel } from './services.js';
/* =========================================================
   FARERIDE MOBILE NETWORK HELPER
   Helps when cellular data briefly drops or changes towers.
========================================================= */
async function fareRideFetchWithRetry(resource, options = {}, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
        cache: "no-store"
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Network request failed (${response.status})`);
      }

      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError || new Error("Network request failed");
}

window.addEventListener("online", () => {
  console.log("FareRide: mobile connection restored");
});

window.addEventListener("offline", () => {
  console.warn("FareRide: mobile connection lost");
});

import {
  db,
  auth,
  doc,
  setDoc,
  onSnapshot
} from "./firebase-config.js";

const RK = 'fareride_rides_v2';
const SK = 'fareride_settings_v2';
const LAST = 'fareride_last_ride_id';

const DEFAULTS = {
  baseFare: 3.5,
  perMile: 2.25,
  comfortMultiplier: 1.25,
  xlMultiplier: 1.5
};

const $ = id =>
  document.getElementById(id);

let estimate = null;
let unsubscribeRide = null;
let estimateVersion = 0;
let submitting = false;
function selectedTip() {
 const choice = $('tipChoice')?.value || '0';
 const percent = choice === 'custom' ? Number($('customTipPercent').value) : Number(choice);
 if (!Number.isFinite(percent) || percent < 0 || percent > 100 || (choice === 'custom' && $('customTipPercent').value === '')) throw new Error('Enter a tip percentage from 0 to 100.');
 return percent;
}
function tipPreview() {
 if (!$('tipChoice')) return;
 $('customTipLabel').hidden = $('tipChoice').value !== 'custom';
 try { const p = selectedTip(), fare = Number(estimate?.fare || 0); $('tipPreview').textContent = estimate?.fare != null ? 'Tip: '+money(Math.round(fare*p)/100)+' | Total: '+money(Math.round((fare+Math.round(fare*p)/100)*100)/100) : 'Tips go to the driver. Calculate a fare to preview the total.'; } catch (e) { $('tipPreview').textContent=e.message; }
}
$('tipChoice')?.addEventListener('change',tipPreview);
$('customTipPercent')?.addEventListener('input',tipPreview);
const selectedService = () => document.querySelector('[name="serviceType"]:checked').value;
function details() {
  return validateServiceDetails(selectedService(), {
    vehicle: $('towVehicle').value, issue: $('towIssue').value,
    packageDescription: $('packageDescription').value, recipientName: $('recipientName').value
  });
}
function invalidateEstimate() {
  estimateVersion++;
  estimate = null;
  $('summary').hidden = true;
  $('requestBtn').disabled = true;
}
function updateService() {
  const type = selectedService();
  $('towDetails').hidden = type !== 'tow';
  $('messengerDetails').hidden = type !== 'messenger';
  $('rideType').closest('label').hidden = type !== 'ride';
  for (const id of ['towVehicle', 'towIssue']) $(id).required = type === 'tow';
  for (const id of ['packageDescription', 'recipientName']) $(id).required = type === 'messenger';
  $('estimateBtn').textContent = type === 'ride' ? 'Calculate mileage & fare' : 'Review quote request';
  $('requestBtn').textContent = SERVICES[type].action;
  $('serviceNote').textContent = type === 'ride' ? 'Choose your ride and calculate an estimate.'
    : 'Request a quote. Price and provider availability must be confirmed before dispatch.';
  invalidateEstimate();
}
$('rideForm').addEventListener('input', event => { if (['tipChoice', 'customTipPercent'].includes(event?.target?.id)) return; invalidateEstimate(); });
document.querySelectorAll('[name="serviceType"]').forEach(input => input.addEventListener('change', updateService));
updateService();


function getSettings() {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(
        localStorage.getItem(SK) || '{}'
      )
    };
  } catch {
    return { ...DEFAULTS };
  }
}


function getRides() {
  try {
    return JSON.parse(
      localStorage.getItem(RK) || '[]'
    );
  } catch {
    return [];
  }
}


function saveRides(rides) {
  localStorage.setItem(
    RK,
    JSON.stringify(rides)
  );
}


function money(value) {
  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD'
    }
  ).format(Number(value) || 0);
}


function showSummary(ride) {
  if (!ride) return;

  $('summary').hidden = false;

  if (ride.pricingStatus === 'quote_required') {
    $('mileage').textContent = 'Confirmed by provider';
    $('duration').textContent = 'Confirmed by provider';
    $('fare').textContent = 'Quote required';
    return;
  }

  $('mileage').textContent =
    Number(
      ride.miles || 0
    ).toFixed(2) + ' miles';

  $('fare').textContent =
    priceLabel(ride, money);

  $('duration').textContent =
    Number(
      ride.durationMinutes || 0
    ) + ' min';
}


function showRideStatus(ride) {
  if (!ride || (ride.riderId && ride.riderId !== auth.currentUser?.uid)) return;
  showSummary(ride);
  const messages = {
    requested: 'Ride requested. Waiting for a driver.',
    accepted: 'Ride accepted. Your driver is on the way.',
    arrived: 'Your driver has arrived at pickup.',
    started: 'Your ride is in progress.',
    completed: 'Ride completed. You can request another ride.',
    cancelled: 'Ride cancelled. You can request another ride.'
  };
  $('msg').textContent = ride.pricingStatus === 'quote_required' && ride.status === 'requested'
    ? 'Quote requested. Waiting for dispatch to confirm pricing.'
    : (messages[ride.status] || 'Waiting for ride information.');
  const finished = ['completed', 'cancelled'].includes(ride.status);
  $('requestBtn').disabled = !finished;
  if (finished && localStorage.getItem(LAST) === ride.id) localStorage.removeItem(LAST);
}

function updateLocalRideFromFirestore(
  rideId,
  firestoreRide
) {
  const rides = getRides();

  const index =
    rides.findIndex(
      ride => ride.id === rideId
    );

  if (index >= 0) {

    rides[index] = {
      ...rides[index],
      ...firestoreRide
    };

    saveRides(rides);
  }
}


function watchRide(rideId) {

  if (unsubscribeRide) {
    unsubscribeRide();
    unsubscribeRide = null;
  }

  unsubscribeRide =
    onSnapshot(
      doc(db, 'rides', rideId),

      snapshot => {

        if (!snapshot.exists()) {
          return;
        }

        const ride = {
          id: snapshot.id,
          ...snapshot.data()
        };

        updateLocalRideFromFirestore(
          rideId,
          ride
        );

        showRideStatus(ride);
      },

      error => {
        console.error(
          'FareRide realtime listener error:',
          error
        );
      }
    );
}


function checkLocalRideStatus() {
  const rideId =
    localStorage.getItem(LAST);

  if (!rideId) return;

  const ride =
    getRides().find(
      item => item.id === rideId
    );

  if (!ride) return;

  showRideStatus(ride);
}


async function geocode(address) {

  const url = new URL(
    'https://nominatim.openstreetmap.org/search'
  );

  url.searchParams.set(
    'format',
    'json'
  );

  url.searchParams.set(
    'limit',
    '1'
  );

  const zip = address.trim().match(/^(\d{5})(?:-\d{4})?$/);
  if (zip) {
    url.searchParams.set('postalcode', zip[1]);
    url.searchParams.set('countrycodes', 'us');
  } else {
    url.searchParams.set('q', address);
  }

  const response =
    await fareRideFetchWithRetry(url);

  const data =
    await response.json();

  if (!data.length) {
    throw new Error(
      'Address not found: ' +
      address
    );
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon)
  };
}


async function getRoute(
  from,
  to
) {

  const response =
    await fareRideFetchWithRetry(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`);

  const data =
    await response.json();

  if (
    data.code !== 'Ok' ||
    !data.routes ||
    !data.routes.length
  ) {
    throw new Error(
      'No route found'
    );
  }

  return data.routes[0];
}


function calculateFare(
  miles,
  rideType
) {

  const settings =
    getSettings();

  let multiplier = 1;

  if (rideType === 'comfort') {
    multiplier =
      settings.comfortMultiplier;
  }

  if (rideType === 'xl') {
    multiplier =
      settings.xlMultiplier;
  }

  return (
    settings.baseFare +
    miles * settings.perMile
  ) * multiplier;
}


async function calculateEstimate() {

  invalidateEstimate();
  const version = estimateVersion;
  const serviceType = selectedService();
  if (serviceType !== 'ride') {
    try {
      const serviceDetails = details();
      const pickup = $('pickup').value.trim(), dropoff = $('dropoff').value.trim();
      if (!pickup || !dropoff) throw new Error('Enter pickup and destination.');
      estimate = { pickup, dropoff, serviceType, serviceDetails, pricingStatus: 'quote_required', fare: null, miles: null, durationMinutes: null, rideType: serviceType, pickupLocation: null, dropoffLocation: null };
      $('summary').hidden = false;
      $('fare').textContent = 'Quote required';
      $('mileage').textContent = 'Confirmed by provider';
      $('duration').textContent = 'Confirmed by provider';
      $('msg').textContent = 'Details ready. Send your quote request.';
      $('requestBtn').disabled = false;
    } catch (error) { $('msg').textContent = error.message; }
    return;
  }

  $('msg').textContent = '';

  const pickup =
    $('pickup').value.trim();

  const dropoff =
    $('dropoff').value.trim();

  if (
    !pickup ||
    !dropoff
  ) {
    $('msg').textContent =
      'Enter pickup and destination.';

    return;
  }

  $('msg').textContent =
    'Calculating route...';

  $('requestBtn').disabled =
    true;

  try {

    const [from, to] =
      await Promise.all([
        geocode(pickup),
        geocode(dropoff)
      ]);

    const route =
      await getRoute(
        from,
        to
      );

    const miles =
      route.distance /
      1609.344;

    const minutes =
      Math.max(
        1,
        Math.round(
          route.duration / 60
        )
      );

    const fare =
      calculateFare(
        miles,
        $('rideType').value
      );

    if (version !== estimateVersion) return;
    estimate = {
      serviceType: 'ride', serviceDetails: {}, pricingStatus: 'estimated',
      pickup,
      dropoff,

      pickupLocation: {
        lat: from.lat,
        lng: from.lon
      },

      dropoffLocation: {
        lat: to.lat,
        lng: to.lon
      },

      miles:
        Number(
          miles.toFixed(2)
        ),

      durationMinutes:
        minutes,

      fare:
        Number(
          fare.toFixed(2)
        ),

      rideType:
        $('rideType').value
    };

    showSummary(estimate);
    tipPreview();

    $('msg').textContent =
      (/^\d{5}(?:-\d{4})?$/.test(pickup) || /^\d{5}(?:-\d{4})?$/.test(dropoff))
        ? 'ZIP-area estimate ready. Use street addresses for an exact pickup and destination.'
        : 'Estimate ready.';

    $('requestBtn').disabled =
      false;

  } catch (error) {

    if (version !== estimateVersion) return;
    console.error(error);

    $('msg').textContent =
      error.message;

    $('requestBtn').disabled =
      true;
  }
}


$('estimateBtn').onclick =
  calculateEstimate;


$('rideType').onchange = () => {

  if (estimate) {
    calculateEstimate();
  }

};


$('rideForm').onsubmit =
async event => {

  event.preventDefault();
  if (submitting) return;
  if (!auth.currentUser) { $('msg').textContent = 'Sign in before requesting a service.'; return; }

  if (!estimate) {

    await calculateEstimate();

    if (!estimate) {
      return;
    }
  }

  let tipPercent = 0;
  try { tipPercent = estimate.fare == null ? 0 : selectedTip(); } catch (error) { $('msg').textContent = error.message; return; }
  const tipAmount = estimate.fare == null ? 0 : Math.round(Number(estimate.fare) * tipPercent) / 100;
  const requestedAt =
    new Date();

  const estimatedArrivalMinutes = estimate.serviceType === 'ride' ? 10 : null;

  const estimatedArrivalAt =
    new Date(
      requestedAt.getTime() +
      estimatedArrivalMinutes *
      60000
    );

  const estimatedFinishAt =
    new Date(
      estimatedArrivalAt.getTime() +
      Number(
        estimate.durationMinutes
      ) *
      60000
    );

  const ride = {

    id:
      'job_' + crypto.randomUUID(),

    serviceType: estimate.serviceType,
    serviceDetails: estimate.serviceDetails,
    pricingStatus: estimate.pricingStatus,

    riderName:
      auth.currentUser.displayName || 'Rider',

    riderId:
      auth.currentUser.uid,

    pickup:
      estimate.pickup,

    dropoff:
      estimate.dropoff,

    pickupLocation:
      estimate.pickupLocation,

    dropoffLocation:
      estimate.dropoffLocation,

    miles:
      estimate.miles,

    durationMinutes:
      estimate.durationMinutes,

    fare:
      estimate.fare,

    rideType:
      estimate.rideType,

    tipPercent,
    tipAmount,

    totalFare:
      estimate.fare == null ? null : Math.round((Number(estimate.fare) + tipAmount)*100)/100,

    status:
      'requested',

    requestedAt:
      requestedAt.toISOString(),

    estimatedArrivalMinutes,

    estimatedArrivalAt:
      estimate.serviceType === 'ride' ? estimatedArrivalAt.toISOString() : null,

    estimatedFinishAt:
      estimate.serviceType === 'ride' ? estimatedFinishAt.toISOString() : null,

    driverId: null,
    driverName: null,

    driverLocation: null,

    acceptedAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null
  };


  submitting = true;
  $('requestBtn').disabled = true;
  /*
    Create the matching
    Firestore ride document.
  */

  try {

    await setDoc(
      doc(
        db,
        'rides',
        ride.id
      ),
      ride
    );

    console.log(
      'FareRide created in Firestore:',
      ride.id
    );

  } catch (error) {

    console.error(
      'Firestore ride creation failed:',
      error
    );

    $('msg').textContent =
      error.code === 'permission-denied' ? 'Request blocked: your rider account must be approved and Firebase ride permissions must be enabled.' : 'Request was not sent. Check your connection and try again.';
    submitting = false;
    $('requestBtn').disabled = false;

    return;
  }


  submitting = false;
  const saved = getRides();
  saved.unshift(ride);
  saveRides(saved);
  localStorage.setItem(LAST, ride.id);
  window.dispatchEvent(new Event('fareride-new-ride'));
  $('msg').textContent =
    'Ride requested - waiting for a driver';

  $('requestBtn').disabled =
    true;

  showRideStatus(ride);

  watchRide(ride.id);
};


window.addEventListener(
  'storage',
  checkLocalRideStatus
);


const existingRideId =
  localStorage.getItem(LAST);

if (existingRideId) {

  checkLocalRideStatus();

  watchRide(
    existingRideId
  );
}
