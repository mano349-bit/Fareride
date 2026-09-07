import {
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot
} from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


const $ = id =>
  document.getElementById(id);


let rides = [];
let applicants = [];

let stopRideListener = null;
let stopApplicantListener = null;
let stopPricingListener = null;


/* =========================================================
   HELPERS
========================================================= */

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


function dateText(value) {

  if (!value) {
    return 'â€”';
  }

  /*
    Firestore Timestamp
  */

  if (
    typeof value === 'object' &&
    typeof value.toDate === 'function'
  ) {

    return value
      .toDate()
      .toLocaleString();

  }

  /*
    ISO string
  */

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return 'â€”';

  }

  return date.toLocaleString();

}


function escapeHtml(value) {

  return String(
    value ?? ''
  )
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


function statusBadge(status) {

  const safe =
    escapeHtml(
      status || 'requested'
    );

  return `
    <span class="status status-${safe}">
      ${safe}
    </span>
  `;

}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

async function isApprovedAdmin(user) {

  if (!user) {
    return false;
  }

  try {

    /*
      Professional admin authorization:

      Firestore:
      admins/{Firebase UID}

      Example:
      admins/
        abc123UID/
          name: "FareRide Administrator"
          active: true
    */

    const adminSnapshot =
      await getDoc(
        doc(
          db,
          'admins',
          user.uid
        )
      );


    if (!adminSnapshot.exists()) {
      return false;
    }


    const admin =
      adminSnapshot.data();


    return (
      admin.active !== false
    );


  } catch (error) {

    console.error(
      'Admin authorization failed:',
      error
    );

    return false;

  }

}


async function handleLogin() {

  const email =
    $('adminEmail')
      .value
      .trim();

  const password =
    $('adminPassword')
      .value;


  $('loginMessage')
    .textContent = '';


  if (
    !email ||
    !password
  ) {

    $('loginMessage')
      .textContent =
        'Enter your email and password.';

    return;

  }


  $('loginBtn').disabled =
    true;

  $('loginBtn').textContent =
    'Signing In...';


  try {

    const credential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


    const approved =
      await isApprovedAdmin(
        credential.user
      );


    if (!approved) {

      await signOut(auth);

      $('loginMessage')
        .textContent =
          'This account is not authorized as a FareRide administrator.';

      return;

    }


    showAdminApp();


  } catch (error) {

    console.error(
      'Admin login failed:',
      error
    );

    $('loginMessage')
      .textContent =
        'Unable to sign in. Check the email and password.';

  } finally {

    $('loginBtn').disabled =
      false;

    $('loginBtn').textContent =
      'Sign In';

  }

}


async function handleLogout() {

  stopLiveListeners();

  await signOut(auth);

  showLogin();

}


function showLogin() {

  $('loginSection')
    .classList
    .remove('hidden');

  $('adminApp')
    .classList
    .add('hidden');

  $('logoutBtn')
    .classList
    .add('hidden');

}


function showAdminApp() {

  $('loginSection')
    .classList
    .add('hidden');

  $('adminApp')
    .classList
    .remove('hidden');

  $('logoutBtn')
    .classList
    .remove('hidden');

  startLiveListeners();

}


/* =========================================================
   AUTH STATE
========================================================= */




/*
  firebase-config.js already exports
  onAuthStateChanged only if you included it.

  We use Firebase Auth's direct listener here.
*/

import(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js"
)
.then(module => {

  module.onAuthStateChanged(
    auth,
    async user => {

      if (!user) {

        showLogin();

        return;

      }


      const approved =
        await isApprovedAdmin(
          user
        );


      if (!approved) {

        await signOut(auth);

        showLogin();

        return;

      }


      showAdminApp();

    }
  );

});


/* =========================================================
   ADMIN TABS
========================================================= */

function showPanel(name) {

  document
    .querySelectorAll(
      '.admin-panel'
    )
    .forEach(panel => {

      panel.classList
        .remove('active');

    });


  document
    .querySelectorAll(
      '.adminTab'
    )
    .forEach(button => {

      button.classList
        .toggle(
          'active',
          button.dataset.panel === name
        );

    });


  const panel =
    document.getElementById(
      'panel-' + name
    );


  if (panel) {

    panel.classList
      .add('active');

  }

}


/* =========================================================
   RIDE STATISTICS
========================================================= */

function updateStats() {

  $('totalCount')
    .textContent =
      rides.length;


  $('requestedCount')
    .textContent =
      rides.filter(
        ride =>
          ride.status ===
          'requested'
      ).length;


  $('activeCount')
    .textContent =
      rides.filter(
        ride =>
          [
            'accepted',
            'arrived',
            'started'
          ].includes(
            ride.status
          )
      ).length;


  $('completedCount')
    .textContent =
      rides.filter(
        ride =>
          ride.status ===
          'completed'
      ).length;


  $('cancelledCount')
    .textContent =
      rides.filter(
        ride =>
          ride.status ===
          'cancelled'
      ).length;

}


/* =========================================================
   RIDE FILTER
========================================================= */

function getFilteredRides() {

  const search =
    $('searchBox')
      .value
      .trim()
      .toLowerCase();


  const status =
    $('statusFilter')
      .value;


  return rides.filter(
    ride => {

      if (
        status !== 'all' &&
        ride.status !== status
      ) {

        return false;

      }


      if (!search) {
        return true;
      }


      const searchable =
        [
          ride.id,
          ride.riderName,
          ride.riderId,
          ride.driverName,
          ride.driverId,
          ride.pickup,
          ride.dropoff,
          ride.status
        ]
        .join(' ')
        .toLowerCase();


      return searchable
        .includes(search);

    }
  );

}


/* =========================================================
   RENDER RIDES
========================================================= */

function renderRides() {

  updateStats();


  const filtered =
    getFilteredRides();


  const table =
    $('ridesTable');


  if (!filtered.length) {

    table.innerHTML = '';

    $('emptyMessage')
      .hidden = false;

    return;

  }


  $('emptyMessage')
    .hidden = true;


  table.innerHTML =
    filtered.map(
      ride => {

        const canCancel =
          ![
            'completed',
            'cancelled'
          ].includes(
            ride.status
          );


        const fare =
          Number(
            ride.fare || 0
          );


        const tip =
          Number(
            ride.tipAmount || 0
          );


        const total =
          Number(
            ride.totalFare ||
            fare + tip
          );


        return `

          <tr>

            <td>
              <strong>
                ${escapeHtml(ride.id)}
              </strong>
            </td>


            <td>
              ${
                escapeHtml(
                  ride.riderName ||
                  'Rider'
                )
              }
            </td>


            <td>
              ${
                escapeHtml(
                  ride.driverName ||
                  'Not assigned'
                )
              }
            </td>


            <td>

              <strong>
                ${
                  escapeHtml(
                    ride.pickup || ''
                  )
                }
              </strong>

              <br>

              â†’

              ${
                escapeHtml(
                  ride.dropoff || ''
                )
              }

            </td>


            <td>

              ${money(fare)}

              ${
                tip
                  ? `
                    <br>
                    Tip:
                    ${money(tip)}

                    <br>
                    <strong>
                      Total:
                      ${money(total)}
                    </strong>
                  `
                  : ''
              }

            </td>


            <td>
              ${
                statusBadge(
                  ride.status
                )
              }
            </td>


            <td>
              ${
                dateText(
                  ride.requestedAt
                )
              }
            </td>


            <td>

              <button
                class="action-btn view-btn"
                data-details="${ride.id}">
                Details
              </button>


              ${
                canCancel
                  ? `
                    <button
                      class="action-btn cancel-btn"
                      data-cancel="${ride.id}">
                      Cancel
                    </button>
                  `
                  : ''
              }

            </td>

          </tr>


          <tr
            id="details-${ride.id}"
            class="details">

            <td colspan="8">

              <div class="details-box">

                <strong>
                  Ride ID:
                </strong>
                ${escapeHtml(ride.id)}
                <br>


                <strong>
                  Rider:
                </strong>
                ${
                  escapeHtml(
                    ride.riderName ||
                    'Rider'
                  )
                }
                <br>


                <strong>
                  Rider ID:
                </strong>
                ${
                  escapeHtml(
                    ride.riderId ||
                    'â€”'
                  )
                }
                <br>


                <strong>
                  Driver:
                </strong>
                ${
                  escapeHtml(
                    ride.driverName ||
                    'Not assigned'
                  )
                }
                <br>


                <strong>
                  Driver ID:
                </strong>
                ${
                  escapeHtml(
                    ride.driverId ||
                    'â€”'
                  )
                }
                <br><br>


                <strong>
                  Pickup:
                </strong>
                ${
                  escapeHtml(
                    ride.pickup || ''
                  )
                }
                <br>


                <strong>
                  Destination:
                </strong>
                ${
                  escapeHtml(
                    ride.dropoff || ''
                  )
                }
                <br>


                <strong>
                  Mileage:
                </strong>

                ${
                  Number(
                    ride.miles ||
                    0
                  ).toFixed(2)
                }
                miles
                <br>


                <strong>
                  Fare:
                </strong>
                ${money(fare)}
                <br>


                <strong>
                  Tip:
                </strong>
                ${money(tip)}
                <br>


                <strong>
                  Total:
                </strong>
                ${money(total)}
                <br><br>


                <strong>
                  Status:
                </strong>
                ${
                  escapeHtml(
                    ride.status ||
                    'requested'
                  )
                }
                <br><br>


                <strong>
                  Requested:
                </strong>
                ${
                  dateText(
                    ride.requestedAt
                  )
                }
                <br>


                <strong>
                  Estimated Driver Arrival:
                </strong>
                ${
                  dateText(
                    ride.estimatedArrivalAt
                  )
                }
                <br>


                <strong>
                  Accepted:
                </strong>
                ${
                  dateText(
                    ride.acceptedAt
                  )
                }
                <br>


                <strong>
                  Arrived:
                </strong>
                ${
                  dateText(
                    ride.arrivedAt
                  )
                }
                <br>


                <strong>
                  Started:
                </strong>
                ${
                  dateText(
                    ride.startedAt
                  )
                }
                <br>


                <strong>
                  Estimated Finish:
                </strong>
                ${
                  dateText(
                    ride.estimatedFinishAt
                  )
                }
                <br>


                <strong>
                  Completed:
                </strong>
                ${
                  dateText(
                    ride.completedAt
                  )
                }
                <br>


                <strong>
                  Cancelled:
                </strong>
                ${
                  dateText(
                    ride.cancelledAt
                  )
                }

              </div>

            </td>

          </tr>

        `;

      }
    )
    .join('');


  document
    .querySelectorAll(
      '[data-details]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            toggleDetails(
              button.dataset.details
            );

          };

      }
    );


  document
    .querySelectorAll(
      '[data-cancel]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            cancelRide(
              button.dataset.cancel
            );

          };

      }
    );

}


/* =========================================================
   RIDE DETAILS
========================================================= */

function toggleDetails(id) {

  const row =
    document.getElementById(
      'details-' + id
    );


  if (!row) {
    return;
  }


  row.classList
    .toggle('open');

}


/* =========================================================
   ADMIN CANCEL RIDE
========================================================= */

async function cancelRide(id) {

  const ride =
    rides.find(
      item =>
        item.id === id
    );


  if (!ride) {
    return;
  }


  if (
    [
      'completed',
      'cancelled'
    ].includes(
      ride.status
    )
  ) {

    return;

  }


  const confirmed =
    confirm(
      'Cancel this FareRide job?'
    );


  if (!confirmed) {
    return;
  }


  try {

    await updateDoc(
      doc(
        db,
        'rides',
        id
      ),
      {
        status:
          'cancelled',

        cancelledAt:
          new Date()
            .toISOString(),

        cancelledBy:
          'admin'
      }
    );


  } catch (error) {

    console.error(
      'Admin cancellation failed:',
      error
    );

    alert(
      'Unable to cancel this ride.'
    );

  }

}


/* =========================================================
   APPLICANT HELPERS
========================================================= */

function applicantStatus(
  applicant
) {

  return (
    applicant.status ||
    'new'
  );

}


function applicantCard(
  applicant
) {

  const status =
    applicantStatus(
      applicant
    );


  return `

    <div class="admin-card">

      <h3>
        ${
          escapeHtml(
            applicant.fullName ||
            'Unnamed Applicant'
          )
        }
      </h3>


      <p>

        <strong>
          Status:
        </strong>

        ${
          escapeHtml(
            status.toUpperCase()
          )
        }

      </p>


      <p>

        <strong>
          Phone:
        </strong>

        ${
          escapeHtml(
            applicant.phone ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Email:
        </strong>

        ${
          escapeHtml(
            applicant.email ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Address:
        </strong>

        ${
          escapeHtml(
            applicant.address ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Vehicle:
        </strong>

        ${
          escapeHtml(
            [
              applicant.vehicleYear,
              applicant.vehicleMake,
              applicant.vehicleModel
            ]
            .filter(Boolean)
            .join(' ') ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Plate:
        </strong>

        ${
          escapeHtml(
            applicant.plateNumber ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Insurance:
        </strong>

        ${
          escapeHtml(
            applicant.insuranceCompany ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Insurance Expiration:
        </strong>

        ${
          escapeHtml(
            applicant.insuranceExpiration ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          SSN Verification:
        </strong>

        Last 4:
        ${
          escapeHtml(
            applicant.ssnLast4 ||
            'â€”'
          )
        }

      </p>


      <p>

        <strong>
          Submitted:
        </strong>

        ${
          dateText(
            applicant.submittedAt
          )
        }

      </p>


      <label>

        <strong>
          Admin Notes
        </strong>

        <br>

        <textarea
          id="notes-${applicant.id}"
          style="
            width:100%;
            min-height:80px;
            margin-top:6px;
            padding:10px;
          ">${
            escapeHtml(
              applicant.adminNotes ||
              ''
            )
          }</textarea>

      </label>


      <br>


      <label>

        <strong>
          Driver Rating
        </strong>

        <select
          id="rating-${applicant.id}"
          style="
            margin-left:8px;
            padding:8px;
          ">

          ${
            [
              5,
              4.9,
              4.8,
              4.7,
              4.6,
              4.5,
              4,
              3.5,
              3
            ]
            .map(
              rating => `

                <option
                  value="${rating}"
                  ${
                    Number(
                      applicant.rating ||
                      5
                    ) ===
                    rating
                      ? 'selected'
                      : ''
                  }>

                  ${rating}

                </option>

              `
            )
            .join('')
          }

        </select>

      </label>


      <br><br>


      <button
        class="action-btn view-btn"
        data-save-applicant="${applicant.id}">
        Save Notes / Rating
      </button>


      ${
        status === 'new'
          ? `
            <button
              class="action-btn approve-btn"
              data-approve="${applicant.id}">
              Approve
            </button>
          `
          : ''
      }


      ${
        status === 'approved'
          ? `
            <button
              class="action-btn suspend-btn"
              data-suspend="${applicant.id}">
              Suspend
            </button>
          `
          : ''
      }


      ${
        status === 'suspended'
          ? `
            <button
              class="action-btn approve-btn"
              data-activate="${applicant.id}">
              Activate
            </button>
          `
          : ''
      }


      <button
        class="action-btn delete-btn"
        data-delete-applicant="${applicant.id}">
        Delete
      </button>

    </div>

  `;

}


/* =========================================================
   RENDER APPLICANTS
========================================================= */

function renderApplicants() {

  const newApplicants =
    applicants.filter(
      applicant =>
        applicantStatus(
          applicant
        ) === 'new'
    );


  const approved =
    applicants.filter(
      applicant =>
        applicantStatus(
          applicant
        ) === 'approved'
    );


  const suspended =
    applicants.filter(
      applicant =>
        applicantStatus(
          applicant
        ) === 'suspended'
    );


  $('newApplicantsList')
    .innerHTML =
      newApplicants.length
        ? newApplicants
            .map(applicantCard)
            .join('')
        : `
          <div class="empty">
            No new applicants.
          </div>
        `;


  $('approvedDriversList')
    .innerHTML =
      approved.length
        ? approved
            .map(applicantCard)
            .join('')
        : `
          <div class="empty">
            No approved drivers.
          </div>
        `;


  $('suspendedDriversList')
    .innerHTML =
      suspended.length
        ? suspended
            .map(applicantCard)
            .join('')
        : `
          <div class="empty">
            No suspended drivers.
          </div>
        `;


  bindApplicantButtons();

}


/* =========================================================
   APPLICANT BUTTONS
========================================================= */

function bindApplicantButtons() {

  document
    .querySelectorAll(
      '[data-save-applicant]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            saveApplicantDetails(
              button.dataset
                .saveApplicant
            );

          };

      }
    );


  document
    .querySelectorAll(
      '[data-approve]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            changeApplicantStatus(
              button.dataset.approve,
              'approved'
            );

          };

      }
    );


  document
    .querySelectorAll(
      '[data-suspend]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            changeApplicantStatus(
              button.dataset.suspend,
              'suspended'
            );

          };

      }
    );


  document
    .querySelectorAll(
      '[data-activate]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            changeApplicantStatus(
              button.dataset.activate,
              'approved'
            );

          };

      }
    );


  document
    .querySelectorAll(
      '[data-delete-applicant]'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            deleteApplicant(
              button.dataset
                .deleteApplicant
            );

          };

      }
    );

}


/* =========================================================
   SAVE APPLICANT NOTES / RATING
========================================================= */

async function saveApplicantDetails(id) {

  const notes =
    document.getElementById(
      'notes-' + id
    );


  const rating =
    document.getElementById(
      'rating-' + id
    );


  try {

    await updateDoc(
      doc(
        db,
        'driverApplications',
        id
      ),
      {
        adminNotes:
          notes
            ? notes.value.trim()
            : '',

        rating:
          rating
            ? Number(
                rating.value
              )
            : 5,

        updatedAt:
          new Date()
            .toISOString()
      }
    );


    alert(
      'Driver information saved.'
    );


  } catch (error) {

    console.error(
      'Applicant save failed:',
      error
    );

    alert(
      'Unable to save applicant information.'
    );

  }

}


/* =========================================================
   APPROVE / SUSPEND / ACTIVATE
========================================================= */

async function changeApplicantStatus(
  id,
  newStatus
) {

  const fields = {

    status:
      newStatus,

    updatedAt:
      new Date()
        .toISOString()

  };


  if (
    newStatus ===
    'approved'
  ) {

    fields.approvedAt =
      new Date()
        .toISOString();

    fields.suspendedAt =
      null;

  }


  if (
    newStatus ===
    'suspended'
  ) {

    fields.suspendedAt =
      new Date()
        .toISOString();

  }


  try {

    await updateDoc(
      doc(
        db,
        'driverApplications',
        id
      ),
      fields
    );


  } catch (error) {

    console.error(
      'Applicant status update failed:',
      error
    );

    alert(
      'Unable to update driver status.'
    );

  }

}


/* =========================================================
   DELETE APPLICANT
========================================================= */

async function deleteApplicant(id) {

  const applicant =
    applicants.find(
      item =>
        item.id === id
    );


  if (!applicant) {
    return;
  }


  const confirmed =
    confirm(
      'Delete application for ' +
      (
        applicant.fullName ||
        'this driver'
      ) +
      '?'
    );


  if (!confirmed) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        'driverApplications',
        id
      )
    );


  } catch (error) {

    console.error(
      'Applicant deletion failed:',
      error
    );

    alert(
      'Unable to delete applicant.'
    );

  }

}


/* =========================================================
   RATES CONTROL
========================================================= */

async function saveRates() {

  const baseFare =
    Number(
      $('baseFareInput')
        .value
    );


  const perMile =
    Number(
      $('perMileInput')
        .value
    );


  const comfort =
    Number(
      $('comfortMultiplierInput')
        .value
    );


  const xl =
    Number(
      $('xlMultiplierInput')
        .value
    );


  const driverShare =
    Number(
      $('driverShareInput')
        .value
    );


  const platformShare =
    Number(
      $('platformShareInput')
        .value
    );


  if (
    driverShare +
    platformShare !==
    100
  ) {

    $('ratesMessage')
      .textContent =
        'Driver share and FareRide share must total 100%.';

    return;

  }


  try {

    await setDoc(
      doc(
        db,
        'pricing',
        'current'
      ),
      {
        baseFare:
          baseFare,

        perMile:
          perMile,

        comfortMultiplier:
          comfort,

        xlMultiplier:
          xl,

        driverSharePercent:
          driverShare,

        platformSharePercent:
          platformShare,

        updatedAt:
          new Date()
            .toISOString()
      },
      {
        merge: true
      }
    );


    $('ratesMessage')
      .textContent =
        'Rates saved successfully.';


  } catch (error) {

    console.error(
      'Rates save failed:',
      error
    );


    $('ratesMessage')
      .textContent =
        'Unable to save rates.';

  }

}


/* =========================================================
   LIVE FIRESTORE LISTENERS
========================================================= */

function startLiveListeners() {

  stopLiveListeners();


  /*
    RIDES
  */

  stopRideListener =
    onSnapshot(
      collection(
        db,
        'rides'
      ),

      snapshot => {

        rides =
          snapshot.docs.map(
            item => ({
              id:
                item.id,

              ...item.data()
            })
          );


        rides.sort(
          (a, b) => {

            const aTime =
              new Date(
                a.requestedAt ||
                0
              ).getTime();

            const bTime =
              new Date(
                b.requestedAt ||
                0
              ).getTime();

            return (
              bTime -
              aTime
            );

          }
        );


        renderRides();

      },

      error => {

        console.error(
          'Admin rides listener failed:',
          error
        );

      }
    );




  /*
    CURRENT PRICING
  */

  stopPricingListener =
    onSnapshot(
      doc(
        db,
        'pricing',
        'current'
      ),

      snapshot => {

        if (
          !snapshot.exists()
        ) {

          return;

        }


        const pricing =
          snapshot.data();


        $('baseFareInput')
          .value =
            pricing.baseFare ??
            3.5;


        $('perMileInput')
          .value =
            pricing.perMile ??
            2.25;


        $('comfortMultiplierInput')
          .value =
            pricing
              .comfortMultiplier ??
            1.25;


        $('xlMultiplierInput')
          .value =
            pricing
              .xlMultiplier ??
            1.5;


        $('driverShareInput')
          .value =
            pricing
              .driverSharePercent ??
            75;


        $('platformShareInput')
          .value =
            pricing
              .platformSharePercent ??
            25;

      },

      error => {

        console.error(
          'Pricing listener failed:',
          error
        );

      }
    );

}


/* =========================================================
   STOP LISTENERS
========================================================= */

function stopLiveListeners() {

  if (stopRideListener) {

    stopRideListener();

    stopRideListener = null;

  }



  if (stopPricingListener) {

    stopPricingListener();

    stopPricingListener = null;

  }

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

$('loginBtn')
  .addEventListener(
    'click',
    handleLogin
  );


$('adminPassword')
  .addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
        'Enter'
      ) {

        handleLogin();

      }

    }
  );


$('logoutBtn')
  .addEventListener(
    'click',
    handleLogout
  );


$('searchBox')
  .addEventListener(
    'input',
    renderRides
  );


$('statusFilter')
  .addEventListener(
    'change',
    renderRides
  );


$('saveRatesBtn')
  .addEventListener(
    'click',
    saveRates
  );


document
  .querySelectorAll(
    '.adminTab'
  )
  .forEach(
    button => {

      button.onclick =
        () => {

          showPanel(
            button.dataset.panel
          );

        };

    }
  );

