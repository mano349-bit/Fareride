# FareRide Android

Installable Android client for the live FareRide website. Includes rider, driver and admin web features, native Home/Rider/Driver navigation, file picker for image/PDF uploads, foreground location permission, external phone dialer links, loading feedback and retry. Requires Android 8 or newer and internet access.

## Install the test APK

Copy FareRide-Android-debug.apk to your Android phone, open it and approve installation from that source. Open FareRide and sign in with your existing account. Allow location when prompted for ride maps and SOS. The APK uses a debug signing key and is intended for testing, not Google Play distribution.

## Build

Install Java 17 or newer and Android SDK platform 36. Set ANDROID_HOME or create ignored local.properties pointing to the SDK. From this directory run:

    gradlew.bat assembleDebug lintDebug

Output: app/build/outputs/apk/debug/app-debug.apk

Application ID: com.fareride.app; version: 1.0.0.

## Device validation before release

On a physical Android phone, verify login persistence across restarting the app, rider and driver navigation, registration image/PDF uploads, precise and approximate location permission, denied permission recovery, active ride map updates, lifecycle buttons, SOS alert confirmation and dialer link, back gestures and airplane-mode retry. Build/lint/signature checks alone do not verify Firebase interactions or GPS on a phone.

## Limits

This version displays the hosted FareRide site in Android WebView. Website updates appear without rebuilding. It does not provide offline rides or a background location service. Location sharing requires the app to remain open and the existing Firebase rules to permit the ride. SOS records an alert in FareRide; the user must dial emergency services. No passwords or Firebase admin credentials are packaged.

Google Play release requires a private release signing key, signed release bundle, privacy policy and store disclosure/review. Preserve the signing key for future updates. Do not commit it.
