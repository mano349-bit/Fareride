import {
  auth,
  db,
  storage,
  doc,
  setDoc,
  ref,
  uploadBytes
} from "./firebase-config.js";



import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
const $ = id =>
  document.getElementById(id);


const MAX_FILE_SIZE =
  10 * 1024 * 1024;


/* =========================================================
   HELPERS
========================================================= */

function cleanFileName(name) {

  return String(name)
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

}


function validFile(file) {

  if (!file) {
    return false;
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    return false;
  }

  return (
    file.type.startsWith(
      "image/"
    ) ||
    file.type ===
      "application/pdf"
  );

}


function makeId(prefix) {

  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2,8)
  );

}


function showMessage(
  id,
  text,
  type
) {

  const box =
    $(id);

  if (!box) {
    return;
  }

  box.textContent =
    text;

  box.className =
    "message " +
    (
      type === "success"
        ? "success-message"
        : "error-message"
    );

}



/* =========================================================
   FARERIDE AUTHENTICATION
========================================================= */

function addPasswordFields(
  formId,
  prefix
) {

  const form =
    document.getElementById(
      formId
    );

  if (
    !form ||
    document.getElementById(
      prefix + "Password"
    )
  ) {
    return;
  }


  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );


  const box =
    document.createElement(
      "div"
    );


  box.innerHTML = `

    <label style="display:block;margin-top:16px;font-weight:700;">
      Password
    </label>

    <input
      id="${prefix}Password"
      type="password"
      autocomplete="new-password"
      minlength="6"
      required
      placeholder="Create password"
      style="width:100%;padding:12px;margin-top:6px;">

    <label style="display:block;margin-top:16px;font-weight:700;">
      Confirm Password
    </label>

    <input
      id="${prefix}ConfirmPassword"
      type="password"
      autocomplete="new-password"
      minlength="6"
      required
      placeholder="Confirm password"
      style="width:100%;padding:12px;margin-top:6px;margin-bottom:14px;">

  `;


  if (submitButton) {

    form.insertBefore(
      box,
      submitButton
    );

  } else {

    form.appendChild(
      box
    );

  }

}


addPasswordFields(
  "riderRegistrationForm",
  "rider"
);


addPasswordFields(
  "driverApplicationForm",
  "driver"
);


async function registerFareRideAccount(
  email,
  password,
  confirmPassword,
  role,
  fullName,
  phone
) {

  if (
    !password ||
    password.length < 6
  ) {

    throw new Error(
      "Password must contain at least 6 characters."
    );

  }


  if (
    password !==
    confirmPassword
  ) {

    throw new Error(
      "Passwords do not match."
    );

  }


  let credential;


  try {

    credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );


  } catch (error) {


    if (
      error.code ===
      "auth/email-already-in-use"
    ) {

      credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


    } else {

      throw error;

    }

  }


  const user =
    credential.user;


  await setDoc(
    doc(
      db,
      "users",
      user.uid
    ),
    {
      uid:
        user.uid,

      email:
        email,

      role:
        role,

      fullName:
        fullName,

      phone:
        phone,

      accountStatus:
        "active",

      updatedAt:
        new Date()
          .toISOString()
    },
    {
      merge:
        true
    }
  );


  if (
    !user.emailVerified
  ) {

    const actionCodeSettings = {
      url: "https://fareride-8b2d1.web.app/rider-login.html",
      handleCodeInApp: false
    };

    try {

      await sendEmailVerification(
        user,
        actionCodeSettings
      );

      console.log(
        "FareRide verification email sent to:",
        email
      );

    } catch (emailError) {

      console.error(
        "VERIFICATION EMAIL FAILED:",
        emailError
      );

      throw new Error(
        "Your FareRide account was created, but the verification email could not be sent. Firebase error: " +
        (emailError.code || emailError.message)
      );

    }

  }


  return user;

}
/* =========================================================
   DOCUMENT UPLOAD
========================================================= */

async function uploadDocument(
  folder,
  applicationId,
  category,
  file
) {

  const fileName =
    cleanFileName(
      file.name
    );


  const path =
    `${folder}/${applicationId}/${category}-${Date.now()}-${fileName}`;


  const storageReference =
    ref(
      storage,
      path
    );


  await uploadBytes(
    storageReference,
    file,
    {
      contentType:
        file.type
    }
  );


  return {

    path:
      path,

    originalName:
      file.name,

    contentType:
      file.type,

    size:
      file.size

  };

}


/* =========================================================
   RIDER REGISTRATION
========================================================= */

async function submitRider(
  event
) {

  event.preventDefault();


  const button =
    $("submitRiderBtn");


  const licenseFile =
    $("riderLicenseFile")
      .files[0];


  if (
    !validFile(
      licenseFile
    )
  ) {

    showMessage(
      "riderApplicationMessage",
      "Driver license must be an image or PDF smaller than 10 MB.",
      "error"
    );

    return;

  }


  button.disabled =
    true;

  button.textContent =
    "Uploading Driver License...";


  try {
    const riderAuthUser =
      await registerFareRideAccount(

        $("riderEmail")
          .value
          .trim(),

        $("riderPassword")
          .value,

        $("riderConfirmPassword")
          .value,

        "rider",

        $("riderFullName")
          .value
          .trim(),

        $("riderPhone")
          .value
          .trim()

      );



    const applicationId =
      makeId(
        "rider"
      );


    const licenseDocument =
      await uploadDocument(
        "riderApplications",
        applicationId,
        "driver-license",
        licenseFile
      );


    button.textContent =
      "Submitting Rider Registration...";


    const application = {

      applicationId:
        applicationId,

      role:
        "rider",

      uid:
        riderAuthUser.uid,

      fullName:
        $("riderFullName")
          .value
          .trim(),

      phone:
        $("riderPhone")
          .value
          .trim(),

      email:
        $("riderEmail")
          .value
          .trim(),

      dateOfBirth:
        $("riderDateOfBirth")
          .value,

      address:
        $("riderAddress")
          .value
          .trim(),

      city:
        $("riderCity")
          .value
          .trim(),

      state:
        $("riderState")
          .value
          .trim(),

      zipCode:
        $("riderZipCode")
          .value
          .trim(),

      documents: {

        driverLicense:
          licenseDocument

      },

      status:
        "new",

      adminNotes:
        "",

      submittedAt:
        new Date()
          .toISOString(),

      approvedAt:
        null,

      suspendedAt:
        null,

      updatedAt:
        new Date()
          .toISOString()

    };


    await setDoc(
      doc(
        db,
        "riderApplications",
        applicationId
      ),
      application
    );


    showMessage(
      "riderApplicationMessage",
      "Rider account created successfully. Check your email to verify your FareRide account, then use Rider Login.",
      "success"
    );


    $("riderRegistrationForm")
      .reset();


  } catch (error) {

    console.error(
      "Rider registration failed:",
      error
    );


    showMessage(
      "riderApplicationMessage",
      "Unable to submit Rider registration. Please try again.",
      "error"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      "Submit Rider Registration";

  }

}


/* =========================================================
   DRIVER REGISTRATION
========================================================= */

async function submitDriver(
  event
) {

  event.preventDefault();


  const button =
    $("submitApplicationBtn");


  const ssnLast4 =
    $("ssnLast4")
      .value
      .trim();


  if (
    !/^[0-9]{4}$/
      .test(
        ssnLast4
      )
  ) {

    showMessage(
      "applicationMessage",
      "SSN Last 4 must contain exactly four numbers.",
      "error"
    );

    return;

  }


  const licenseFile =
    $("driverLicenseFile")
      .files[0];


  const insuranceFile =
    $("insuranceFile")
      .files[0];


  const registrationFile =
    $("registrationFile")
      .files[0];


  const files = [
    licenseFile,
    insuranceFile,
    registrationFile
  ];


  if (
    files.some(
      file =>
        !validFile(file)
    )
  ) {

    showMessage(
      "applicationMessage",
      "All Driver documents must be an image or PDF and each must be smaller than 10 MB.",
      "error"
    );

    return;

  }


  button.disabled =
    true;

  button.textContent =
    "Uploading Driver License...";


  try {
    const driverAuthUser =
      await registerFareRideAccount(

        $("email")
          .value
          .trim(),

        $("driverPassword")
          .value,

        $("driverConfirmPassword")
          .value,

        "driver",

        $("fullName")
          .value
          .trim(),

        $("phone")
          .value
          .trim()

      );



    const applicationId =
      makeId(
        "driver"
      );


    const documents = {};


    documents.driverLicense =
      await uploadDocument(
        "driverApplications",
        applicationId,
        "driver-license",
        licenseFile
      );


    button.textContent =
      "Uploading Insurance...";


    documents.insurance =
      await uploadDocument(
        "driverApplications",
        applicationId,
        "insurance",
        insuranceFile
      );


    button.textContent =
      "Uploading Vehicle Registration...";


    documents.vehicleRegistration =
      await uploadDocument(
        "driverApplications",
        applicationId,
        "vehicle-registration",
        registrationFile
      );


    button.textContent =
      "Submitting Driver Application...";


    const application = {

      applicationId:
        applicationId,

      role:
        "driver",

      uid:
        driverAuthUser.uid,

      fullName:
        $("fullName")
          .value
          .trim(),

      phone:
        $("phone")
          .value
          .trim(),

      email:
        $("email")
          .value
          .trim(),

      dateOfBirth:
        $("dateOfBirth")
          .value,

      address:
        $("address")
          .value
          .trim(),

      city:
        $("city")
          .value
          .trim(),

      state:
        $("state")
          .value
          .trim(),

      zipCode:
        $("zipCode")
          .value
          .trim(),

      ssnLast4:
        ssnLast4,

      vehicleYear:
        $("vehicleYear")
          .value,

      vehicleMake:
        $("vehicleMake")
          .value
          .trim(),

      vehicleModel:
        $("vehicleModel")
          .value
          .trim(),

      vehicleColor:
        $("vehicleColor")
          .value
          .trim(),

      plateNumber:
        $("plateNumber")
          .value
          .trim(),

      insuranceCompany:
        $("insuranceCompany")
          .value
          .trim(),

      insurancePolicyNumber:
        $("insurancePolicyNumber")
          .value
          .trim(),

      insuranceExpiration:
        $("insuranceExpiration")
          .value,

      applicantNotes:
        $("applicantNotes")
          .value
          .trim(),

      status:
        "new",

      adminNotes:
        "",

      rating:
        5,

      documents:
        documents,

      submittedAt:
        new Date()
          .toISOString(),

      approvedAt:
        null,

      suspendedAt:
        null,

      updatedAt:
        new Date()
          .toISOString()

    };


    await setDoc(
      doc(
        db,
        "driverApplications",
        applicationId
      ),
      application
    );


    showMessage(
      "applicationMessage",
      "Driver account and application created successfully. Check your email to verify your FareRide account.",
      "success"
    );


    $("driverApplicationForm")
      .reset();


  } catch (error) {

    console.error(
      "Driver application failed:",
      error
    );


    showMessage(
      "applicationMessage",
      "Unable to submit Driver application. Please try again.",
      "error"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      "Submit Driver Application";

  }

}


/* =========================================================
   RIDER / DRIVER SWITCH
========================================================= */

function showRider() {

  $("riderRegistrationForm")
    .classList
    .remove(
      "hidden"
    );


  $("driverApplicationForm")
    .classList
    .add(
      "hidden"
    );


  $("showRiderBtn")
    .classList
    .add(
      "active"
    );


  $("showDriverBtn")
    .classList
    .remove(
      "active"
    );

}


function showDriver() {

  $("driverApplicationForm")
    .classList
    .remove(
      "hidden"
    );


  $("riderRegistrationForm")
    .classList
    .add(
      "hidden"
    );


  $("showDriverBtn")
    .classList
    .add(
      "active"
    );


  $("showRiderBtn")
    .classList
    .remove(
      "active"
    );

}


/* =========================================================
   EVENTS
========================================================= */

$("showRiderBtn")
  .addEventListener(
    "click",
    showRider
  );


$("showDriverBtn")
  .addEventListener(
    "click",
    showDriver
  );


$("riderRegistrationForm")
  .addEventListener(
    "submit",
    submitRider
  );


$("driverApplicationForm")
  .addEventListener(
    "submit",
    submitDriver
  );


