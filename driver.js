import {isDriverOnline, observeDriverOnline} from './driver-availability.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {visibleDriverJobs, jobMatchesFilter} from './driver-jobs.js?v=20261026-first-claim';
import {notifyNewRides, resetRideAlerts} from './driver-alerts.js?v=20261013-all-jobs';
import { escapeHTML } from './ride-ui.js';
import { actionButtons } from './driver-actions.js?v=20261026-first-claim';
import { auth, getDoc, onAuthStateChanged } from './firebase-session.js';
import { query, where, runTransaction } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {claimDriverDetails} from './driver-claim.js';
import { serviceName, priceLabel } from './services.js';
import {
  db,
  doc,
  collection,
  updateDoc,
  onSnapshot
} from "./firebase-session.js";

const RK = 'fareride_rides_v2';

let DRIVER_ID = null;
let DRIVER_NAME = '';

const ACTIVE_RIDE_KEY =
  'fareride_active_driver_ride';

const $ = id =>
  document.getElementById(id);

let rides = [];
let acceptingJob=false;

function acceptFromDashboard(id) {
 if(!DRIVER_ID){setDriverMessage('Sign in as an approved driver to accept jobs.');return;}
 if(acceptingJob)return;
 if(!isDriverOnline()){
  window.dispatchEvent(new Event('fareride-go-online'));
  setDriverMessage('Going online. Allow location access, then choose Accept Job when a request appears.');return;
 }
 const job=rides.find(job=>job.id===id);
 if(!job){setDriverMessage('No available jobs match this filter. New requests appear automatically while you are online.');return;}
 if(job.serviceType==='tow'){
  const card=[...document.querySelectorAll('[data-tow-ride]')].find(card=>card.dataset.towRide===id);
  const accept=card&&[...card.querySelectorAll('button')].find(button=>button.textContent==='Accept offer');
  if(accept&&!accept.disabled){accept.click();return;}
  card?.scrollIntoView({behavior:'smooth',block:'center'});
  setDriverMessage('Review this job in Tow offers & rider issues. Accept the rider’s price there, or send a counteroffer.');return;
 }
 acceptRide(id);
}

const jobFilter=()=> $('jobServiceFilter')?.value || 'all';
$('jobServiceFilter')?.addEventListener('change', renderRequests);


/* ========================================
   LOCAL BACKUP
======================================== */

function saveLocalBackup() {

  try { localStorage.setItem(RK, JSON.stringify(rides)); }
  catch(error) { console.warn('Local job backup unavailable; live jobs remain enabled.', error); }

}


/* ========================================
   ACTIVE DRIVER RIDE
======================================== */

function setActiveDriverRide(id) {

  if (!id) return;

  try { localStorage.setItem(ACTIVE_RIDE_KEY,id); } catch(error) { console.warn('Unable to cache the active ride.',error); }

  if (
    window.FareRideDriverLocation
  ) {

    window
      .FareRideDriverLocation
      .setActiveRide(id);

  }

}


function clearActiveDriverRide() {

  try { localStorage.removeItem(ACTIVE_RIDE_KEY); } catch(error) { console.warn('Unable to clear the local ride cache.',error); }

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


  const visibleRides = visibleDriverJobs(rides,DRIVER_ID,jobFilter(),isDriverOnline());

  const selectedJob = visibleRides.find(ride => ride.driverId === DRIVER_ID && ride.status !== 'requested') || visibleRides[0];
  $('driverControls').innerHTML = actionButtons(selectedJob || { id: '', status: 'unavailable' }, DRIVER_ID);
  const primaryAccept=$('driverControls').querySelector('.acceptRide');
  if(primaryAccept){primaryAccept.disabled=!DRIVER_ID||acceptingJob;primaryAccept.onclick=()=>acceptFromDashboard(selectedJob?.id);}

  $('driverControlsStatus').textContent = selectedJob
    ? `Controls for ${selectedJob.riderName || 'Rider'}: ${selectedJob.pickup || 'Pickup'}. Current stage: ${selectedJob.status}.`
    : isDriverOnline() ? 'No new jobs are available right now.' : 'You are offline. Go online to receive new jobs. Your current trip remains available.';

  if (!visibleRides.length) {

    list.innerHTML = `
      <div class="card">
        <p>
          ${isDriverOnline() ? 'No job requests match this filter right now.' : 'You are offline. Go online to receive new job requests.'}
        </p>
      </div>
    `;

    return;
  }


  list.innerHTML =
    visibleRides.map(
      ride => {

        const button = actionButtons(ride, DRIVER_ID);

        return `

          <div class="card">

            <p class="service-badge">${serviceName(ride.serviceType)}</p>
            <h3>
              ${escapeHTML(ride.riderName || 'Rider')}
            </h3>

            <p>
              <strong>Status:</strong>
              ${escapeHTML(ride.status || 'requested')}
            </p>

            <p>
              <strong>Pickup:</strong>
              ${escapeHTML(ride.pickup || '')}
            </p>

            <p>
              <strong>Destination:</strong>
              ${escapeHTML(ride.dropoff || '')}
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
              ${priceLabel(ride,money)}
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

            ${ride.serviceType === 'tow' ? '<p>Enter your price and message the rider in Tow offers &amp; rider issues.</p>' : ''}
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

        if($('driverControls').contains(button))return;
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
  if(acceptingJob)return;
  if (!isDriverOnline()) { setDriverMessage('Go online before accepting a new job.'); return; }
  const job = rides.find(ride => ride.id === id);
  if (!job || job.serviceType === 'tow' || job.status !== 'requested') {
    setDriverMessage('This job is not available in your service queue.');
    return;
  }

  const now =
    new Date()
      .toISOString();

  try {

    acceptingJob=true;renderRequests();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in as an approved driver.');
    // Application data enriches the trip; it must not veto an otherwise valid claim.
    const application = await getDoc(doc(db, 'driverApplications', 'driver_' + uid)).catch(() => null);
    const profile = await getDoc(doc(db, 'users', uid));
    if (!profile.exists() || profile.data().role !== 'driver') throw new Error('Sign in with your Driver account.');
    const details = claimDriverDetails(uid, profile.data(), application?.exists() ? application.data() : {});
    await runTransaction(db, async transaction => {
      const rideRef = doc(db, 'rides', id);
      const current = await transaction.get(rideRef);
      if (!isDriverOnline()) throw new Error('You are offline. Go online before accepting a job.');
      if (!current.exists() || current.data().status !== 'requested' || current.data().driverId) {
        throw new Error('Another driver has already accepted this ride.');
      }
      transaction.update(rideRef, { status: 'accepted', ...details, acceptedAt: now });
    });
    /*
      This is important for
      live GPS on the phone.
    */

    rides=rides.map(ride=>ride.id===id?{...ride,status:'accepted',...details,acceptedAt:now}:ride);
    renderRequests();
    setActiveDriverRide(id);


    setDriverMessage(
      'Ride accepted — ' + DRIVER_NAME
    );


  } catch (error) {

    console.error(
      'Accept ride failed:',
      error
    );

    setDriverMessage(
      error.code==='permission-denied' ? 'Job assignment was blocked by the server. Contact FareRide Admin (permission-denied).' : (error.message || 'Unable to accept ride. Please retry.')
    );

  }

  finally {acceptingJob=false;renderRequests();}
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
 const expected=DRIVER_ID,parts=[new Map(),new Map()],ready=[false,false];let stopped=false,requestRevision=0;
 const listen=(index,condition,version=requestRevision)=>liveSnapshot(query(collection(db,'rides'),condition),{includeMetadataChanges:true},snapshot=>{
  if(stopped||auth.currentUser?.uid!==expected||DRIVER_ID!==expected||(index===0&&(!isDriverOnline()||version!==requestRevision)))return;
  parts[index]=new Map(snapshot.docs.map(d=>[d.id,{...d.data(),id:d.id}]));
  if(snapshot.metadata?.fromCache!==true)ready[index]=true;
  rides=[...new Map([...parts[0],...parts[1]]).values()].sort((a,b)=>{
   const time=value=>value?.toMillis?value.toMillis():new Date(value||0).getTime();
   return time(b.requestedAt)-time(a.requestedAt);
  });
  if(isDriverOnline()&&ready.every(Boolean))notifyNewRides(rides,jobFilter(),snapshot.metadata?.fromCache===true);
  saveLocalBackup();
  const active=rides.find(job=>job.driverId===expected&&['accepted','arrived','started'].includes(job.status));
  if(active){setActiveDriverRide(active.id);window.dispatchEvent(new Event('fareride-active-ride'));}
  else clearActiveDriverRide();
  renderRequests();
 },error=>{
  if(stopped||auth.currentUser?.uid!==expected)return;
  console.error('Driver job listener failed:',error);
  setDriverMessage(index===0?'Unable to load new job requests. Check your connection and driver approval.':'Unable to load your assigned jobs. Check your connection and driver approval.');
 });
 let stopRequests;
 const stopAssigned=listen(1,where('driverId','==',expected));
 const stopAvailability=observeDriverOnline(online=>{
  requestRevision++;stopRequests?.();stopRequests=null;parts[0].clear();ready[0]=false;
  rides=rides.filter(job=>job.driverId===expected);
  resetRideAlerts();renderRequests();
  if(online)stopRequests=listen(0,where('status','==','requested'));
 });
 return ()=>{stopped=true;stopAvailability();stopRequests?.();stopAssigned();};
}


/* ========================================
   START
======================================== */

let stopRides = null;
onAuthStateChanged(auth, async user => {
  resetRideAlerts();
  stopRides?.(); stopRides = null; rides = []; DRIVER_ID = null;
  clearActiveDriverRide(); renderRequests();
  if (!user) { setDriverMessage('Sign in using Driver Login to see jobs.'); return; }
  const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (auth.currentUser?.uid !== user.uid || !profile?.exists()) return;
  const data = profile.data();
  if (data.role !== 'driver' || !['approved', 'active'].includes(data.accountStatus)) { setDriverMessage('An approved driver account is required to accept jobs.'); return; }
  setDriverMessage('');
  DRIVER_ID = user.uid; DRIVER_NAME = data.fullName || 'Driver';
  stopRides = startRideListener();
});
