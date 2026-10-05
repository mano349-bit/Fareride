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
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

const storage = getStorage(auth.app);


let driverApplicants = [];
let riderApplicants = [];

let stopDriverApplicants = null;
let stopRiderApplicants = null;


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function dateText(value) {

  if (!value) {
    return "-";
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

    return "-";

  }

  return date.toLocaleString();

}


function statusOf(item) {

  return item.status || "new";

}


function getField(prefix, field, id) {

  const input =
    document.getElementById(
      prefix + "-" + field + "-" + id
    );

  return input
    ? input.value.trim()
    : "";

}


function documentBox(documents) {

  documents = documents || {};

  const rows = [];

  function documentRow(label, file) {

    if (!file) {
      return;
    }

    const name =
      file.originalName ||
      file.path ||
      "Uploaded";

    const path =
      file.path || "";

    rows.push(`
      <div class="document-row">
        <strong>${escapeHtml(label)}:</strong><br>

        <span>
          ${escapeHtml(name)}
        </span>

        ${
          path
            ? `
              <br><br>
              <button
                type="button"
                class="action-btn view-btn"
                data-open-storage-document="${escapeHtml(path)}">
                View / Open
              </button>
            `
            : ""
        }
      </div>
    `);

  }

  documentRow(
    "Driver License",
    documents.driverLicense
  );

  documentRow(
    "Insurance",
    documents.insurance
  );

  documentRow(
    "Vehicle Registration",
    documents.vehicleRegistration
  );

  if (!rows.length) {

    return `
      <div class="document-box">
        <strong>Uploaded Documents</strong>
        <div class="document-row">
          No document information found.
        </div>
      </div>
    `;

  }

  return `
    <div class="document-box">
      <strong>Uploaded Documents</strong>
      ${rows.join("")}
    </div>
  `;

}


/* =========================================================
   DRIVER CARD
========================================================= */

function driverCard(applicant) {

  const id =
    applicant.id;

  const status =
    statusOf(applicant);


  return `

    <div class="admin-card">

      <div class="applicant-heading">

        <div>

          <h3>
            ${escapeHtml(
              applicant.fullName ||
              "Unnamed Driver"
            )}
          </h3>

          <div class="applicant-id">
            Applicant ID:
            ${escapeHtml(id)}
          </div>

        </div>

        <div class="applicant-type">
          DRIVER -
          ${escapeHtml(
            status.toUpperCase()
          )}
        </div>

      </div>


      <div class="applicant-grid">

        <div class="info-item">
          <strong>Phone</strong>
          ${escapeHtml(
            applicant.phone || "-"
          )}
        </div>


        <div class="info-item">
          <strong>Email</strong>
          ${escapeHtml(
            applicant.email || "-"
          )}
        </div>


        <div class="info-item">
          <strong>Date of Birth</strong>
          ${escapeHtml(
            applicant.dateOfBirth || "-"
          )}
        </div>


        <div class="info-item">

          <strong>Address</strong>

          ${escapeHtml(
            applicant.address || "-"
          )}

          <br>

          ${escapeHtml(
            [
              applicant.city,
              applicant.state,
              applicant.zipCode
            ]
            .filter(Boolean)
            .join(", ")
          )}

        </div>


        <div class="info-item">

          <strong>Vehicle</strong>

          ${escapeHtml(
            [
              applicant.vehicleYear,
              applicant.vehicleMake,
              applicant.vehicleModel,
              applicant.vehicleColor
            ]
            .filter(Boolean)
            .join(" ") ||
            "-"
          )}

        </div>


        <div class="info-item">

          <strong>Plate</strong>

          ${escapeHtml(
            applicant.plateNumber ||
            "-"
          )}

        </div>


        <div class="info-item">

          <strong>Insurance</strong>

          ${escapeHtml(
            applicant.insuranceCompany ||
            "-"
          )}

          <br>

          ${escapeHtml(
            applicant.insurancePolicyNumber ||
            ""
          )}

        </div>


        <div class="info-item">

          <strong>
            Insurance Expiration
          </strong>

          ${escapeHtml(
            applicant.insuranceExpiration ||
            "-"
          )}

        </div>


        <div class="info-item">

          <strong>
            SSN Verification
          </strong>

          Last 4:
          ${escapeHtml(
            applicant.ssnLast4 ||
            "-"
          )}

        </div>


        <div class="info-item">

          <strong>Submitted</strong>

          ${dateText(
            applicant.submittedAt
          )}

        </div>

      </div>


      ${documentBox(
        applicant.documents
      )}


      <div
        id="driver-edit-${escapeHtml(id)}"
        class="hidden">

        <div class="edit-grid">

          <label>
            Full Name
            <input
              id="driver-fullName-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.fullName || ""
              )}">
          </label>


          <label>
            Phone
            <input
              id="driver-phone-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.phone || ""
              )}">
          </label>


          <label>
            Email
            <input
              id="driver-email-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.email || ""
              )}">
          </label>


          <label>
            Date of Birth
            <input
              id="driver-dateOfBirth-${escapeHtml(id)}"
              type="date"
              value="${escapeHtml(
                applicant.dateOfBirth || ""
              )}">
          </label>


          <label class="edit-full">
            Address
            <input
              id="driver-address-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.address || ""
              )}">
          </label>


          <label>
            City
            <input
              id="driver-city-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.city || ""
              )}">
          </label>


          <label>
            State
            <input
              id="driver-state-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.state || ""
              )}">
          </label>


          <label>
            ZIP
            <input
              id="driver-zipCode-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.zipCode || ""
              )}">
          </label>


          <label>
            Vehicle Year
            <input
              id="driver-vehicleYear-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.vehicleYear || ""
              )}">
          </label>


          <label>
            Vehicle Make
            <input
              id="driver-vehicleMake-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.vehicleMake || ""
              )}">
          </label>


          <label>
            Vehicle Model
            <input
              id="driver-vehicleModel-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.vehicleModel || ""
              )}">
          </label>


          <label>
            Vehicle Color
            <input
              id="driver-vehicleColor-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.vehicleColor || ""
              )}">
          </label>


          <label>
            Plate Number
            <input
              id="driver-plateNumber-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.plateNumber || ""
              )}">
          </label>


          <label>
            Insurance Company
            <input
              id="driver-insuranceCompany-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.insuranceCompany || ""
              )}">
          </label>


          <label>
            Policy Number
            <input
              id="driver-insurancePolicyNumber-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.insurancePolicyNumber || ""
              )}">
          </label>


          <label>
            Insurance Expiration
            <input
              id="driver-insuranceExpiration-${escapeHtml(id)}"
              type="date"
              value="${escapeHtml(
                applicant.insuranceExpiration || ""
              )}">
          </label>


          <label class="edit-full">

            Applicant Notes

            <textarea
              id="driver-applicantNotes-${escapeHtml(id)}">${escapeHtml(
                applicant.applicantNotes || ""
              )}</textarea>

          </label>

        </div>


        <button
          class="action-btn save-edit-btn"
          data-save-driver="${escapeHtml(id)}">

          Save Changes

        </button>


        <button
          class="action-btn cancel-edit-btn"
          data-cancel-driver-edit="${escapeHtml(id)}">

          Cancel Edit

        </button>

      </div>


      <br>


      <label>

        <strong>
          Admin Notes
        </strong>

        <br>

        <textarea
          id="driver-notes-${escapeHtml(id)}"
          style="
            width:100%;
            min-height:80px;
            margin-top:6px;
            padding:10px;
          ">${escapeHtml(
            applicant.adminNotes || ""
          )}</textarea>

      </label>


      <br>


      <label>

        <strong>
          Driver Rating
        </strong>

        <select
          id="driver-rating-${escapeHtml(id)}"
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
                      applicant.rating || 5
                    ) === rating
                      ? "selected"
                      : ""
                  }>

                  ${rating}

                </option>

              `
            )
            .join("")
          }

        </select>

      </label>


      <br><br>


      <button
        class="action-btn edit-btn"
        data-edit-driver="${escapeHtml(id)}">

        Edit Applicant

      </button>


      <button
        class="action-btn view-btn"
        data-save-driver-notes="${escapeHtml(id)}">

        Save Notes / Rating

      </button>


      ${
        ![
          "approved",
          "suspended"
        ].includes(status)
          ? `
            <button
              class="action-btn approve-btn"
              data-driver-status="${escapeHtml(id)}"
              data-status="approved">

              Approve

            </button>
          `
          : ""
      }


      ${
        status === "approved"
          ? `
            <button
              class="action-btn suspend-btn"
              data-driver-status="${escapeHtml(id)}"
              data-status="suspended">

              Suspend

            </button>
          `
          : ""
      }


      ${
        status === "suspended"
          ? `
            <button
              class="action-btn approve-btn"
              data-driver-status="${escapeHtml(id)}"
              data-status="approved">

              Activate

            </button>
          `
          : ""
      }


      <button
        class="action-btn delete-btn"
        data-delete-driver="${escapeHtml(id)}">

        Delete

      </button>

    </div>

  `;

}


/* =========================================================
   RIDER CARD
========================================================= */

function riderCard(applicant) {

  const id =
    applicant.id;

  const status =
    statusOf(applicant);


  return `

    <div class="admin-card">

      <div class="applicant-heading">

        <div>

          <h3>
            ${escapeHtml(
              applicant.fullName ||
              "Unnamed Rider"
            )}
          </h3>

          <div class="applicant-id">
            Applicant ID:
            ${escapeHtml(id)}
          </div>

        </div>


        <div class="applicant-type">
          RIDER -
          ${escapeHtml(
            status.toUpperCase()
          )}
        </div>

      </div>


      <div class="applicant-grid">

        <div class="info-item">
          <strong>Phone</strong>
          ${escapeHtml(
            applicant.phone || "-"
          )}
        </div>


        <div class="info-item">
          <strong>Email</strong>
          ${escapeHtml(
            applicant.email || "-"
          )}
        </div>


        <div class="info-item">

          <strong>
            Date of Birth
          </strong>

          ${escapeHtml(
            applicant.dateOfBirth ||
            "-"
          )}

        </div>


        <div class="info-item">

          <strong>Address</strong>

          ${escapeHtml(
            applicant.address || "-"
          )}

          <br>

          ${escapeHtml(
            [
              applicant.city,
              applicant.state,
              applicant.zipCode
            ]
            .filter(Boolean)
            .join(", ")
          )}

        </div>


        <div class="info-item">

          <strong>Status</strong>

          ${escapeHtml(
            status.toUpperCase()
          )}

        </div>


        <div class="info-item">

          <strong>Submitted</strong>

          ${dateText(
            applicant.submittedAt
          )}

        </div>

      </div>


      ${documentBox(
        applicant.documents
      )}


      <div
        id="rider-edit-${escapeHtml(id)}"
        class="hidden">

        <div class="edit-grid">

          <label>
            Full Name
            <input
              id="rider-fullName-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.fullName || ""
              )}">
          </label>


          <label>
            Phone
            <input
              id="rider-phone-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.phone || ""
              )}">
          </label>


          <label>
            Email
            <input
              id="rider-email-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.email || ""
              )}">
          </label>


          <label>
            Date of Birth
            <input
              id="rider-dateOfBirth-${escapeHtml(id)}"
              type="date"
              value="${escapeHtml(
                applicant.dateOfBirth || ""
              )}">
          </label>


          <label class="edit-full">
            Address
            <input
              id="rider-address-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.address || ""
              )}">
          </label>


          <label>
            City
            <input
              id="rider-city-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.city || ""
              )}">
          </label>


          <label>
            State
            <input
              id="rider-state-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.state || ""
              )}">
          </label>


          <label>
            ZIP
            <input
              id="rider-zipCode-${escapeHtml(id)}"
              value="${escapeHtml(
                applicant.zipCode || ""
              )}">
          </label>

        </div>


        <button
          class="action-btn save-edit-btn"
          data-save-rider="${escapeHtml(id)}">

          Save Changes

        </button>


        <button
          class="action-btn cancel-edit-btn"
          data-cancel-rider-edit="${escapeHtml(id)}">

          Cancel Edit

        </button>

      </div>


      <br>


      <label>

        <strong>
          Admin Notes
        </strong>

        <br>

        <textarea
          id="rider-notes-${escapeHtml(id)}"
          style="
            width:100%;
            min-height:80px;
            margin-top:6px;
            padding:10px;
          ">${escapeHtml(
            applicant.adminNotes || ""
          )}</textarea>

      </label>


      <br><br>


      <button
        class="action-btn edit-btn"
        data-edit-rider="${escapeHtml(id)}">

        Edit Rider

      </button>


      <button
        class="action-btn view-btn"
        data-save-rider-notes="${escapeHtml(id)}">

        Save Admin Notes

      </button>


      ${
        ![
          "approved",
          "suspended"
        ].includes(status)
          ? `
            <button
              class="action-btn approve-btn"
              data-rider-status="${escapeHtml(id)}"
              data-status="approved">

              Approve

            </button>
          `
          : ""
      }


      ${
        status === "approved"
          ? `
            <button
              class="action-btn suspend-btn"
              data-rider-status="${escapeHtml(id)}"
              data-status="suspended">

              Suspend

            </button>
          `
          : ""
      }


      ${
        status === "suspended"
          ? `
            <button
              class="action-btn approve-btn"
              data-rider-status="${escapeHtml(id)}"
              data-status="approved">

              Activate

            </button>
          `
          : ""
      }


      <button
        class="action-btn delete-btn"
        data-delete-rider="${escapeHtml(id)}">

        Delete

      </button>

    </div>

  `;

}


/* =========================================================
   RENDER DRIVER APPLICATIONS
========================================================= */

function renderDrivers() {

  const newDrivers =
    driverApplicants.filter(
      item =>
        ![
          "approved",
          "suspended"
        ].includes(
          statusOf(item)
        )
    );


  const approvedDrivers =
    driverApplicants.filter(
      item =>
        statusOf(item) === "approved"
    );


  const suspendedDrivers =
    driverApplicants.filter(
      item =>
        statusOf(item) === "suspended"
    );


  const newList =
    document.getElementById(
      "newApplicantsList"
    );


  const approvedList =
    document.getElementById(
      "approvedDriversList"
    );


  const suspendedList =
    document.getElementById(
      "suspendedDriversList"
    );


  if (newList) {

    newList.innerHTML =
      newDrivers.length
        ? newDrivers
            .map(driverCard)
            .join("")
        : `
          <div class="empty">
            No new Driver applicants.
          </div>
        `;

  }


  if (approvedList) {

    approvedList.innerHTML =
      approvedDrivers.length
        ? approvedDrivers
            .map(driverCard)
            .join("")
        : `
          <div class="empty">
            No approved Drivers.
          </div>
        `;

  }


  if (suspendedList) {

    suspendedList.innerHTML =
      suspendedDrivers.length
        ? suspendedDrivers
            .map(driverCard)
            .join("")
        : `
          <div class="empty">
            No suspended Drivers.
          </div>
        `;

  }


  bindDriverButtons();

}


/* =========================================================
   RENDER RIDER APPLICATIONS
========================================================= */

function renderRiders() {

  const pendingRiders =
    riderApplicants.filter(
      item =>
        ![
          "approved",
          "suspended"
        ].includes(
          statusOf(item)
        )
    );


  const approvedRiders =
    riderApplicants.filter(
      item =>
        statusOf(item) === "approved"
    );


  const suspendedRiders =
    riderApplicants.filter(
      item =>
        statusOf(item) === "suspended"
    );


  const pendingList =
    document.getElementById(
      "riderApplicantsList"
    );


  const approvedList =
    document.getElementById(
      "approvedRidersList"
    );


  if (pendingList) {

    pendingList.innerHTML =
      pendingRiders.length
        ? pendingRiders
            .map(riderCard)
            .join("")
        : `
          <div class="empty">
            No pending Rider applications.
          </div>
        `;

  }


  if (approvedList) {

    approvedList.innerHTML =
      approvedRiders.length
        ? approvedRiders
            .map(riderCard)
            .join("")
        : `
          <div class="empty">
            No approved Riders yet.
          </div>
        `;

  }


  bindRiderButtons();

}

/* =========================================================
   DRIVER BUTTONS
========================================================= */

function bindDriverButtons() {

  document
    .querySelectorAll(
      "[data-edit-driver]"
    )
    .forEach(button => {

      button.onclick =
        () => {

          const box =
            document.getElementById(
              "driver-edit-" +
              button.dataset.editDriver
            );


          if (box) {

            box.classList
              .remove("hidden");

          }

        };

    });


  document
    .querySelectorAll(
      "[data-cancel-driver-edit]"
    )
    .forEach(button => {

      button.onclick =
        () => {

          const box =
            document.getElementById(
              "driver-edit-" +
              button.dataset.cancelDriverEdit
            );


          if (box) {

            box.classList
              .add("hidden");

          }

        };

    });


  document
    .querySelectorAll(
      "[data-save-driver]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          saveDriver(
            button.dataset.saveDriver
          );

    });


  document
    .querySelectorAll(
      "[data-save-driver-notes]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          saveDriverNotes(
            button.dataset.saveDriverNotes
          );

    });


  document
    .querySelectorAll(
      "[data-driver-status]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          changeStatus(
            "driverApplications",
            button.dataset.driverStatus,
            button.dataset.status
          );

    });


  document
    .querySelectorAll(
      "[data-delete-driver]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteApplicant(
            "driverApplications",
            button.dataset.deleteDriver,
            driverApplicants
          );

    });

}


/* =========================================================
   RIDER BUTTONS
========================================================= */

function bindRiderButtons() {

  document
    .querySelectorAll(
      "[data-edit-rider]"
    )
    .forEach(button => {

      button.onclick =
        () => {

          const box =
            document.getElementById(
              "rider-edit-" +
              button.dataset.editRider
            );


          if (box) {

            box.classList
              .remove("hidden");

          }

        };

    });


  document
    .querySelectorAll(
      "[data-cancel-rider-edit]"
    )
    .forEach(button => {

      button.onclick =
        () => {

          const box =
            document.getElementById(
              "rider-edit-" +
              button.dataset.cancelRiderEdit
            );


          if (box) {

            box.classList
              .add("hidden");

          }

        };

    });


  document
    .querySelectorAll(
      "[data-save-rider]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          saveRider(
            button.dataset.saveRider
          );

    });


  document
    .querySelectorAll(
      "[data-save-rider-notes]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          saveRiderNotes(
            button.dataset.saveRiderNotes
          );

    });


  document
    .querySelectorAll(
      "[data-rider-status]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          changeStatus(
            "riderApplications",
            button.dataset.riderStatus,
            button.dataset.status
          );

    });


  document
    .querySelectorAll(
      "[data-delete-rider]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteApplicant(
            "riderApplications",
            button.dataset.deleteRider,
            riderApplicants
          );

    });

}


/* =========================================================
   SAVE DRIVER EDIT
========================================================= */

async function saveDriver(id) {

  try {

    await updateDoc(
      doc(
        db,
        "driverApplications",
        id
      ),
      {

        fullName:
          getField(
            "driver",
            "fullName",
            id
          ),

        phone:
          getField(
            "driver",
            "phone",
            id
          ),

        email:
          getField(
            "driver",
            "email",
            id
          ),

        dateOfBirth:
          getField(
            "driver",
            "dateOfBirth",
            id
          ),

        address:
          getField(
            "driver",
            "address",
            id
          ),

        city:
          getField(
            "driver",
            "city",
            id
          ),

        state:
          getField(
            "driver",
            "state",
            id
          ),

        zipCode:
          getField(
            "driver",
            "zipCode",
            id
          ),

        vehicleYear:
          getField(
            "driver",
            "vehicleYear",
            id
          ),

        vehicleMake:
          getField(
            "driver",
            "vehicleMake",
            id
          ),

        vehicleModel:
          getField(
            "driver",
            "vehicleModel",
            id
          ),

        vehicleColor:
          getField(
            "driver",
            "vehicleColor",
            id
          ),

        plateNumber:
          getField(
            "driver",
            "plateNumber",
            id
          ),

        insuranceCompany:
          getField(
            "driver",
            "insuranceCompany",
            id
          ),

        insurancePolicyNumber:
          getField(
            "driver",
            "insurancePolicyNumber",
            id
          ),

        insuranceExpiration:
          getField(
            "driver",
            "insuranceExpiration",
            id
          ),

        applicantNotes:
          getField(
            "driver",
            "applicantNotes",
            id
          ),

        updatedAt:
          new Date()
            .toISOString()

      }
    );


    alert(
      "Driver applicant information saved."
    );


  } catch (error) {

    console.error(
      "Driver applicant edit failed:",
      error
    );


    alert(
      "Unable to save Driver applicant."
    );

  }

}


/* =========================================================
   SAVE DRIVER NOTES
========================================================= */

async function saveDriverNotes(id) {

  const notes =
    document.getElementById(
      "driver-notes-" + id
    );


  const rating =
    document.getElementById(
      "driver-rating-" + id
    );


  try {

    await updateDoc(
      doc(
        db,
        "driverApplications",
        id
      ),
      {

        adminNotes:
          notes
            ? notes.value.trim()
            : "",

        rating:
          rating
            ? Number(rating.value)
            : 5,

        updatedAt:
          new Date()
            .toISOString()

      }
    );


    alert(
      "Driver notes and rating saved."
    );


  } catch (error) {

    console.error(
      "Driver notes save failed:",
      error
    );


    alert(
      "Unable to save Driver notes."
    );

  }

}


/* =========================================================
   SAVE RIDER EDIT
========================================================= */

async function saveRider(id) {

  try {

    await updateDoc(
      doc(
        db,
        "riderApplications",
        id
      ),
      {

        fullName:
          getField(
            "rider",
            "fullName",
            id
          ),

        phone:
          getField(
            "rider",
            "phone",
            id
          ),

        email:
          getField(
            "rider",
            "email",
            id
          ),

        dateOfBirth:
          getField(
            "rider",
            "dateOfBirth",
            id
          ),

        address:
          getField(
            "rider",
            "address",
            id
          ),

        city:
          getField(
            "rider",
            "city",
            id
          ),

        state:
          getField(
            "rider",
            "state",
            id
          ),

        zipCode:
          getField(
            "rider",
            "zipCode",
            id
          ),

        updatedAt:
          new Date()
            .toISOString()

      }
    );


    alert(
      "Rider information saved."
    );


  } catch (error) {

    console.error(
      "Rider edit failed:",
      error
    );


    alert(
      "Unable to save Rider information."
    );

  }

}


/* =========================================================
   SAVE RIDER NOTES
========================================================= */

async function saveRiderNotes(id) {

  const notes =
    document.getElementById(
      "rider-notes-" + id
    );


  try {

    await updateDoc(
      doc(
        db,
        "riderApplications",
        id
      ),
      {

        adminNotes:
          notes
            ? notes.value.trim()
            : "",

        updatedAt:
          new Date()
            .toISOString()

      }
    );


    alert(
      "Rider Admin notes saved."
    );


  } catch (error) {

    console.error(
      "Rider notes save failed:",
      error
    );


    alert(
      "Unable to save Rider notes."
    );

  }

}


/* =========================================================
   APPROVE / SUSPEND / ACTIVATE
========================================================= */

async function changeStatus(
  collectionName,
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
    newStatus === "approved"
  ) {

    fields.approvedAt =
      new Date()
        .toISOString();

    fields.suspendedAt =
      null;
  }


  if (
    newStatus === "suspended"
  ) {

    fields.suspendedAt =
      new Date()
        .toISOString();
  }


  try {

    const applicationRef =
      doc(
        db,
        collectionName,
        id
      );


    const applicationSnapshot =
      await getDoc(
        applicationRef
      );


    if (
      !applicationSnapshot.exists()
    ) {

      throw new Error(
        "Application was not found."
      );
    }


    const application =
      applicationSnapshot.data();


    await updateDoc(
      applicationRef,
      fields
    );


    if (
      application.uid
    ) {

      await setDoc(
        doc(
          db,
          "users",
          application.uid
        ),
        {
          approved:
            newStatus === "approved",

          accountStatus:
            newStatus,

          updatedAt:
            new Date()
              .toISOString()
        },
        {
          merge:
            true
        }
      );
    }


    console.log(
      "Applicant status updated:",
      collectionName,
      id,
      newStatus
    );


  } catch (error) {

    console.error(
      "Applicant status change failed:",
      error
    );


    alert(
      "Unable to update applicant status."
    );
  }
}

/* =========================================================
   DELETE
========================================================= */

async function deleteApplicant(
  collectionName,
  id,
  list
) {

  const applicant =
    list.find(
      item =>
        item.id === id
    );


  if (!applicant) {
    return;
  }


  const confirmed =
    confirm(
      "Delete application for " +
      (
        applicant.fullName ||
        "this applicant"
      ) +
      "?"
    );


  if (!confirmed) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        collectionName,
        id
      )
    );


  } catch (error) {

    console.error(
      "Applicant deletion failed:",
      error
    );


    alert(
      "Unable to delete applicant."
    );

  }

}


/* =========================================================
   LIVE LISTENERS
========================================================= */

function stopListeners() {

  if (stopDriverApplicants) {

    stopDriverApplicants();

    stopDriverApplicants =
      null;

  }


  if (stopRiderApplicants) {

    stopRiderApplicants();

    stopRiderApplicants =
      null;

  }

}


function startListeners() {

  stopListeners();


  stopDriverApplicants =
    onSnapshot(

      collection(
        db,
        "driverApplications"
      ),

      snapshot => {

        driverApplicants =
          snapshot.docs.map(
            item => ({
              id:
                item.id,

              ...item.data()
            })
          );


        driverApplicants.sort(
          (a, b) =>
            new Date(
              b.submittedAt || 0
            ).getTime()
            -
            new Date(
              a.submittedAt || 0
            ).getTime()
        );


        renderDrivers();

      },


      error => {

        console.error(
          "Driver applicant listener failed:",
          error
        );

      }

    );


  stopRiderApplicants =
    onSnapshot(

      collection(
        db,
        "riderApplications"
      ),

      snapshot => {

        riderApplicants =
          snapshot.docs.map(
            item => ({
              id:
                item.id,

              ...item.data()
            })
          );


        riderApplicants.sort(
          (a, b) =>
            new Date(
              b.submittedAt || 0
            ).getTime()
            -
            new Date(
              a.submittedAt || 0
            ).getTime()
        );


        renderRiders();

      },


      error => {

        console.error(
          "Rider applicant listener failed:",
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

      startListeners();

    } else {

      stopListeners();

      driverApplicants = [];

      riderApplicants = [];

    }

  }
);

document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        "[data-open-storage-document]"
      );

    if (!button) {
      return;
    }

    const path =
      button.dataset.openStorageDocument;

    if (!path) {
      return;
    }

    try {

      button.disabled = true;
      button.textContent = "Opening...";

      const url =
        await getDownloadURL(
          storageRef(
            storage,
            path
          )
        );

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

    } catch (error) {

      console.error(
        "Unable to open uploaded document:",
        error
      );

      alert(
        "Unable to open this uploaded document."
      );

    } finally {

      button.disabled = false;
      button.textContent = "View / Open";

    }

  }
);
