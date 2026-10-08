import { saveLoginSession } from './login-persistence.js';
import { withDeadline } from './login-network.js';
import {
  auth,
  db
} from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut, setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDocFromServer
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const fareRideVerificationSettings = {
  url: new URL('./rider-login.html', window.location.href).href,
  handleCodeInApp: false
};
const role =
  document.body.dataset.role;

const email =
  document.getElementById("email");

const password =
  document.getElementById("password");

const loginButton =
  document.getElementById("loginButton");

const forgotButton =
  document.getElementById("forgotButton");

const resendButton =
  document.getElementById("resendButton");

const message =
  document.getElementById("message");


function showMessage(text, good = false) {

  message.textContent = text;

  message.style.color =
    good
      ? "#18c96e"
      : "#ff5252";

}


function friendlyError(error) {

  const code =
    error?.code || "";

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "Incorrect email or password.";
  }

  if (
    code === "auth/invalid-email"
  ) {
    return "Please enter a valid email address.";
  }

  if (
    code === "auth/too-many-requests"
  ) {
    return "Too many attempts. Please wait a little and try again.";
  }

  if (
    code === "auth/network-request-failed"
  ) {
    return "Internet connection problem. Check your connection and try again.";
  }

  if (code === "auth/web-storage-unsupported") return "Safari could not save the login. Open FareRide in a regular Safari tab with website storage enabled.";
  if (code === "unavailable" || code === "deadline-exceeded") return "Your sign-in is saved, but the account check could not connect. Please try again when connected.";
  return (
    error?.message ||
    "Unable to sign in."
  );

}


async function login() {
  if (loginButton.disabled) return;

  const userEmail =
    email.value.trim();

  const userPassword =
    password.value;

  if (
    !userEmail ||
    !userPassword
  ) {

    showMessage(
      "Please enter your email and password."
    );

    return;

  }


  loginButton.disabled = true;
  loginButton.textContent =
    "Signing In...";


  try {

    await saveLoginSession(auth, setPersistence, browserLocalPersistence, browserSessionPersistence);
    const credential =
      await signInWithEmailAndPassword(
        auth,
        userEmail,
        userPassword
      );

    const user =
      credential.user;



    showMessage("Signed in. Checking your FareRide account…", true);
    const profileSnapshot =
      await withDeadline(getDocFromServer(
        doc(
          db,
          "users",
          user.uid
        )
      ));


    if (
      !profileSnapshot.exists()
    ) {

      showMessage(
        "Your login is saved, but your FareRide profile was not found on the server. Please contact FareRide Admin."
      );

      return;

    }


    const profile =
      profileSnapshot.data();


    const profileRole = String(profile.role || "").trim().toLowerCase();
    const status = String(profile.accountStatus || profile.status || "").trim().toLowerCase();
    const approved = profile.approved === true || status === "approved" || status === "active";

    if (!user.emailVerified && !approved) {

      showMessage(
        "Your FareRide account is waiting for approval. Verify your email, or wait for FareRide Admin to approve your application."
      );

      resendButton.style.display =
        "block";

      return;

    }


    if (
      profileRole !== role
    ) {

      await signOut(auth);

      showMessage(
        role === "driver"
          ? "This is not a Driver account. Please use Rider Login."
          : "This is not a Rider account. Please use Driver Login."
      );

      return;

    }


    showMessage(
      "Login successful.",
      true
    );


    setTimeout(
      () => {

        window.location.href =
          role === "driver"
            ? "./driver.html"
            : "./rider.html";

      },
      500
    );


  } catch (error) {

    console.error(
      "FareRide login error:",
      error
    );

    showMessage(
      friendlyError(error)
    );

  } finally {

    loginButton.disabled =
      false;

    loginButton.textContent =
      role === "driver"
        ? "Driver Login"
        : "Rider Login";

  }

}


async function forgotPassword() {

  const userEmail =
    email.value.trim();

  if (!userEmail) {

    showMessage(
      "Enter your email address first."
    );

    return;

  }


  try {

    await sendPasswordResetEmail(
      auth,
      userEmail
    );

    showMessage(
      "Password reset email sent. Check Inbox and Spam.",
      true
    );

  } catch (error) {

    console.error(error);

    showMessage(
      friendlyError(error)
    );

  }

}


async function resendVerification() {

  try {

    if (!auth.currentUser) {

      if (
        !email.value.trim() ||
        !password.value
      ) {

        showMessage(
          "Enter your email and password first."
        );

        return;

      }


      await signInWithEmailAndPassword(
        auth,
        email.value.trim(),
        password.value
      );

    }


    const actionCodeSettings = {
      url:
        role === "driver"
          ? new URL('./driver-login.html', window.location.href).href
          : new URL('./rider-login.html', window.location.href).href,

      handleCodeInApp:
        false
    };


    await sendEmailVerification(
      auth.currentUser,
      actionCodeSettings
    );


    showMessage(
      "Verification email sent again. Check Inbox and Spam.",
      true
    );


  } catch (error) {

    console.error(error);

    showMessage(
      friendlyError(error)
    );

  }

}


loginButton.addEventListener(
  "click",
  login
);


forgotButton.addEventListener(
  "click",
  forgotPassword
);


resendButton.addEventListener(
  "click",
  resendVerification
);


password.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      login();

    }

  }
);

const loginReason = new URL(window.location.href).searchParams.get('reason');
if (loginReason === 'session-missing') showMessage('Safari could not restore your saved login. Please sign in again. If this repeats, send us this exact message.');
if (loginReason === 'account-access') showMessage('Your account is not approved for this page, or its role does not match. Please contact FareRide Admin.');
