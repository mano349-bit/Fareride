import {
  auth,
  db
} from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const fareRideVerificationSettings = {
  url: "https://fareride-8b2d1.web.app/verify-email.html",
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

  return (
    error?.message ||
    "Unable to sign in."
  );

}


async function login() {

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

    const credential =
      await signInWithEmailAndPassword(
        auth,
        userEmail,
        userPassword
      );

    const user =
      credential.user;



    const profileSnapshot =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );


    if (
      !profileSnapshot.exists()
    ) {

      await signOut(auth);

      showMessage(
        "FareRide account profile was not found. Please register first."
      );

      return;

    }


    const profile =
      profileSnapshot.data();


    if (
      !user.emailVerified &&
      profile.approved !== true
    ) {

      showMessage(
        "Your FareRide account is waiting for approval. Verify your email, or wait for FareRide Admin to approve your application."
      );

      resendButton.style.display =
        "block";

      return;

    }


    if (
      profile.role !== role
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
          ? "https://fareride-8b2d1.web.app/driver-login.html"
          : "https://fareride-8b2d1.web.app/rider-login.html",

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
