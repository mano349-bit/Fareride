import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {createVehiclePicker} from './vehicle-picker.js?v=20261013-regular-vehicles';
import {TOW_PRICING, calculateTowFare} from './tow-pricing.js';
import { SERVICES, validateServiceDetails, priceLabel } from './services.js';
/* =========================================================
   FARERIDE MOBILE NETWORK HELPER
   Helps when cellular data briefly drops or changes towers.
========================================================= */
async function fareRideFetchWithRetry(resource, options = {}, attempts = 3, timeoutMs = 30000) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
  setDoc, getDoc,
  onSnapshot
} from "./firebase-session.js";

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
let watchedRideId = null;
let estimateVersion = 0;
let submitting = false;
const vehiclePicker = createVehiclePicker();
const selectedService = () => document.querySelector('[name="serviceType"]:checked').value;
function details() {
  return validateServiceDetails(selectedService(), {
    vehicle: selectedService() === 'tow' ? vehiclePicker.description() : '', issue: $('towIssue').value, vehicleClass: $('towVehicleClass')?.value || 'light',
    packageDescription: $('packageDescription').value, recipientName: $('recipientName').value
  });
}
function invalidateEstimate() {
  estimateVersion++;
  estimate = null;
  $('summary').hidden = true;
  $('requestBtn').disabled = true;
  if ($('towEstimateBreakdown')) $('towEstimateBreakdown').hidden = true;
  
}
function updateService() {
  const type = selectedService();
  $('towDetails').hidden = type !== 'tow';
  $('messengerDetails').hidden = type !== 'messenger';
  $('rideType').closest('label').hidden = type !== 'ride';
  vehiclePicker.setActive(type === 'tow');
  $('towIssue').required = type === 'tow';
  for (const id of ['packageDescription', 'recipientName']) $(id).required = type === 'messenger';
  const specialty = type === 'tow' && $('towVehicleClass')?.value === 'specialty';
  $('estimateBtn').textContent = specialty ? 'Review quote request' : type === 'tow' ? 'Calculate towing mileage & fare' : 'Calculate mileage & fare';
  $('requestBtn').textContent = specialty ? 'Request towing quote' : SERVICES[type].action;
  $('serviceNote').textContent = type !== 'tow' ? 'Choose your service and calculate an estimate. Bike delivery costs 15% less than Economy sedan rates.'
    : specialty ? 'Heavy vehicles and recovery require a provider quote before dispatch.' : 'Standard light-duty towing uses $112 hookup + $6 per loaded mile. Final price and availability must be confirmed with the tow driver.';
  invalidateEstimate();
}
$('rideForm').addEventListener('input', event => { invalidateEstimate(); });
document.querySelectorAll('[name="serviceType"]').forEach(input => input.addEventListener('change', updateService));
updateService();
$('towVehicleClass')?.addEventListener('change', updateService);

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

  const towBreakdown = $('towEstimateBreakdown');
  if (towBreakdown) towBreakdown.hidden = true;
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

  $('duration').textContent = Number(ride.durationMinutes || 0) + (ride.serviceType === 'tow' ? ' min driving (loading time extra)' : ' min');
  if (towBreakdown && ride.serviceType === 'tow' && ride.pricingStatus === 'estimated') {
    towBreakdown.hidden = false;
    towBreakdown.textContent = 'Estimated towing: ' + money(TOW_PRICING.hookup) + ' hookup + ' + Number(ride.miles).toFixed(2) + ' miles × ' + money(TOW_PRICING.perMile) + '/mile = ' + money(ride.fare) + '. Tips are separate. Taxes, tolls, recovery, storage, after-hours and specialty equipment are not included; confirm the final price with the tow driver.';
  }
}


function showRideStatus(ride) {
  if (!ride || (ride.riderId && ride.riderId !== auth.currentUser?.uid)) return;
  showSummary(ride);
  const messages = {
    requested: 'Ride requested. Waiting for a driver.',
    accepted: 'Ride accepted. Your driver is on the way.',
    arrived: 'Your driver has arrived at pickup.',
    started: 'Your ride is in progress.',
    completed: '',
    cancelled: 'Ride cancelled. You can request another ride.'
  };
  $('msg').textContent = ride.pricingStatus === 'quote_required' && ride.status === 'requested'
    ? 'Tow quote requested. Review driver offers in Tow driver offers & live messages.'
    : (messages[ride.status] ?? 'Waiting for ride information.');
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
  const listenerUID=auth.currentUser?.uid;
  if(!listenerUID||!rideId)return;
  watchedRideId=rideId;

  if (unsubscribeRide) {
    unsubscribeRide();
    unsubscribeRide = null;
  }

  unsubscribeRide =
    liveSnapshot(
      doc(db, 'rides', rideId),

      snapshot => {

        if (watchedRideId!==rideId||auth.currentUser?.uid!==listenerUID||!snapshot.exists()||snapshot.data().riderId!==listenerUID) {
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
        if(watchedRideId!==rideId||auth.currentUser?.uid!==listenerUID)return;
        watchedRideId=null;
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
  const zipCode = address.trim().match(/^(\d{5})(?:-\d{4})?$/)?.[1];
  if (zipCode) {
    try {
      // Dedicated US ZIP lookup avoids ambiguous or missing postal-area searches.
      const response = await fareRideFetchWithRetry('https://api.zippopotam.us/us/' + zipCode, {}, 1, 10000);
      const data = await response.json();
      const place = data.places?.[0];
      const lat = Number(place?.latitude), lon = Number(place?.longitude);
      if (place && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180) return {lat,lon};
    } catch { /* Keep the existing postal-area lookup as a fallback. */ }
  }


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

  if (!Array.isArray(data) || !data.length) {
    throw new Error(
      'Address not found: ' +
      address
    );
  }

  const lat=Number(data[0].lat),lon=Number(data[0].lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Location lookup returned invalid coordinates. Retry or use a street address.');
  return {lat,lon};
}


async function getRoute(from, to) {
  for (const point of [from,to]) {
    if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)throw new Error('Invalid pickup or destination coordinates.');
  }
  const coordinates=`${from.lon},${from.lat};${to.lon},${to.lat}`;
  const providers=['https://router.project-osrm.org/route/v1/driving/','https://routing.openstreetmap.de/routed-car/route/v1/driving/'];
  let noRoute=false;
  for(let index=0;index<providers.length;index++){
    try {
      const response=await fareRideFetchWithRetry(providers[index]+coordinates+'?overview=false&steps=false&alternatives=false',{},1,20000);
      const data=await response.json(),route=data.routes?.[0];
      if(data.code==='NoRoute'){noRoute=true;continue;}
      if(data.code!=='Ok'||!route||!Number.isFinite(route.distance)||!Number.isFinite(route.duration)||route.distance<0||route.duration<0)continue;
      return route;
    } catch { /* A busy public route service must not prevent a second real route lookup. */ }
  }
  throw new Error(noRoute?'No driving route found. Check the pickup and destination addresses.':'Route services are busy or unreachable. Retry shortly; no fare or mileage has been invented.');
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
  if (serviceType === 'tow' && $('towVehicleClass')?.value === 'specialty') {
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

  let serviceDetails;
  try { serviceDetails = details(); } catch (error) { $('msg').textContent = error.message; return; }
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

    const fare = serviceType === 'tow'
      ? calculateTowFare(Number(miles.toFixed(2)))
      : serviceType === 'messenger'
        ? calculateFare(miles, 'economy') * 0.85
        : calculateFare(miles, $('rideType').value);

    if (version !== estimateVersion) return;
    estimate = {
      serviceType, serviceDetails, pricingStatus: 'estimated',
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

      rideType: serviceType === 'tow' ? 'tow' : serviceType === 'messenger' ? 'economy' : $('rideType').value
    };

    window.dispatchEvent(new CustomEvent("fareride-pickup-location",{detail:estimate.pickupLocation}));
    showSummary(estimate);
    

    $('msg').textContent =
      (/^\d{5}(?:-\d{4})?$/.test(pickup) || /^\d{5}(?:-\d{4})?$/.test(dropoff))
        ? 'ZIP-area estimate ready. Use street addresses for an exact pickup and destination.'
        : serviceType === 'tow' ? 'Tow estimate ready. Confirm the final price with the tow driver before towing.' : 'Estimate ready.';

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

  const tipPercent = 0;
  const tipAmount = 0;
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

  const riderProfile = await getDoc(doc(db, 'users', auth.currentUser.uid)).catch(() => null);
  if (!riderProfile?.exists()) { $('msg').textContent = 'Unable to load your rider profile. Retry before requesting.'; return; }
  const profile = riderProfile.data();
  const ride = {

    id:
      'job_' + crypto.randomUUID(),

    serviceType: estimate.serviceType,
    serviceDetails: estimate.serviceDetails,
    pricingStatus: estimate.pricingStatus,

    riderName:
      profile.fullName || auth.currentUser.displayName || 'Rider',

    riderPhone: String(profile.phone || ''),
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

window.addEventListener('fareride-ride-restored',event=>{
 const ride=event.detail;if(!ride||ride.riderId!==auth.currentUser?.uid)return;
 updateLocalRideFromFirestore(ride.id,ride);showRideStatus(ride);
 if(watchedRideId!==ride.id)watchRide(ride.id);
});
