import {
  auth,
  db
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


const page = window.location.pathname.toLowerCase();

const requiredRole =
  page.includes("driver")
    ? "driver"
    : page.includes("rider")
      ? "rider"
      : "";

const loginPage =
  requiredRole === "driver"
    ? "./driver-login.html"
    : "./rider-login.html";


onAuthStateChanged(auth, async user => {

  if (!user) {
    window.location.replace(loginPage);
    return;
  }

  try {

    const snapshot =
      await getDoc(
        doc(db, "users", user.uid)
      );

    if (!snapshot.exists()) {
      console.error("FareRide user profile missing:", user.uid);
      await signOut(auth);
      window.location.replace(loginPage);
      return;
    }

    const profile = snapshot.data();

    const profileRole =
      String(profile.role || "")
        .trim()
        .toLowerCase();

    const status =
      String(
        profile.accountStatus ||
        profile.status ||
        ""
      )
      .trim()
      .toLowerCase();

    const approved =
      profile.approved === true ||
      status === "approved" ||
      status === "active";

    console.log(
      "FareRide auth check:",
      {
        email: user.email,
        firebaseEmailVerified: user.emailVerified,
        role: profileRole,
        requiredRole: requiredRole,
        approved: approved,
        status: status
      }
    );

    /*
      IMPORTANT:
      Admin-approved users may enter even when
      Firebase emailVerified is false.
    */

    if (
      !user.emailVerified &&
      !approved
    ) {
      console.warn(
        "FareRide account is neither email verified nor admin approved."
      );

      await signOut(auth);
      window.location.replace(loginPage);
      return;
    }

    /*
      Make sure Driver goes only to Driver area
      and Rider goes only to Rider area.
    */

    if (
      requiredRole &&
      profileRole &&
      profileRole !== requiredRole
    ) {
      console.warn(
        "Wrong FareRide role:",
        profileRole,
        requiredRole
      );

      await signOut(auth);
      window.location.replace(loginPage);
      return;
    }

    console.log(
      "FARE RIDE ACCESS GRANTED:",
      user.email
    );

  } catch (error) {

    console.error(
      "FareRide authentication guard error:",
      error
    );

    /*
      Do not log an authenticated driver out
      merely because Firestore temporarily fails.
    */
  }

});
