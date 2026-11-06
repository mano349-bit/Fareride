# FareRide payment integration — sandbox only

This change adds Firebase Functions payment endpoints and rider, driver and admin payment pages. It does not activate live merchant accounts or deploy itself. Existing Hosting-only deployments are insufficient.

## Supported test paths

- Stripe-hosted card checkout, plus explicit-consent Setup checkout for saved test cards. Saved cards belong to the authenticated rider's Stripe customer. All payments remain on-session; this does not authorize future automatic charges. A customer confirms the selected saved card in Stripe checkout.
- PayPal sandbox approval and server capture. Approval/return URL parameters alone never mark a ride paid. Check payment status captures an approved order using a stable request ID, then verifies the completed capture and amount.
- Intuit Payments sandbox token charges, submitted by FareRide Admin only. A rider first chooses Intuit card or eCheck; Admin supplies a one-time payment token generated in Intuit's sandbox and confirms customer authorization. FareRide does not tokenize or collect raw card numbers, CVV, account or routing numbers. It is not a physical GoPayment reader integration.
- ACH/eCheck is deliberately left pending after submission. Automated ACH settlement reconciliation is NOT included and must be implemented and verified against the merchant's actual Intuit settlement contract before production use. No success is invented from an accepted/pending eCheck.

The supplied Merchant Service Center links are operator-side tools, not customer checkout links:
https://merchantcenter.intuit.com/msc/portal/tpc/cc
https://merchantcenter.intuit.com/msc/portal/tpc/check
Do not redirect riders to them or use real merchant transactions to test this sandbox integration. GoPayment's physical reader/mobile-app collection is a separate live workflow.

## Required configuration

1. Confirm the exact correct FareRide Hosting domain and Firebase project. An earlier link opened a different FairRide website; do not guess which domain should receive checkout redirects.
2. Use a Firebase project with billing enabled for Functions and Secret Manager. Install the functions dependencies with `npm ci --prefix functions`. Node.js 22 is the deployment runtime.
3. Create the secret named `PAYMENT_SANDBOX_CONFIG` using the Firebase CLI's hidden prompt:

   npx.cmd firebase-tools functions:secrets:set PAYMENT_SANDBOX_CONFIG --project YOUR_CONFIRMED_PROJECT_ID

   The secret value is one JSON object with the following keys. Fill only services ready for testing; missing services stay unavailable in the UI. Do not commit the real JSON or send it in chat:

   {"stripeSecret":"sk_test_...","stripeWebhookSecret":"whsec_...","paypalClientId":"sandbox client ID","paypalSecret":"sandbox secret","intuitAccessToken":"sandbox OAuth access token","intuitTokenExpiresAt":0}

   `intuitTokenExpiresAt` must be the real token expiry as Unix milliseconds. Intuit access tokens expire; refresh them via the approved Intuit developer/OAuth flow, then update the secret and redeploy. Automated OAuth onboarding and refresh-token rotation are not implemented in this sandbox version. Only sandbox.api.intuit.com is used.
4. Set the Functions parameter `PAYMENT_APP_ORIGIN` to the confirmed HTTPS app origin, e.g. `https://YOUR_CONFIRMED_HOST`. No path or trailing query. Use the CLI deployment prompt or an ignored functions/.env.PROJECT_ID file. No origin was guessed in this PR.
5. Deploy all three components, not just Hosting:

   npx.cmd firebase-tools deploy --only "functions:paymentsApi,hosting,firestore:rules" --project YOUR_CONFIRMED_PROJECT_ID

6. Add a TEST Stripe webhook endpoint at `https://YOUR_CONFIRMED_HOST/api/payments/stripe/webhook`, subscribed to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Save its signing secret into PAYMENT_SANDBOX_CONFIG, then redeploy the function. Payment status can also be verified by the signed-in rider if the webhook has not arrived.
7. Test with approved rider/driver accounts. Finish the job and record verified tax (including explicit zero if exempt) first. Finalize tips and tolls before starting checkout. The request locks charge editing to keep the provider total aligned with the saved receipt. Cancelling an open Stripe checkout through the app expires it at Stripe before allowing a new method. PayPal and Intuit attempts cannot be reset from the browser; Admin must reconcile an unresolved attempt before replacing it.

## Security and recovery

Provider credentials are server-only Secret Manager values. Customer identifiers, attempts and archives are denied to browser Firestore clients, including admin browser sessions. The API checks Firebase ID tokens, active/approved account status, role, assigned job, amount, currency, attempt identity and sandbox mode. Browser redirect success parameters are not proof of payment. Test payments never write the live paymentStatus field; receipts explicitly show test mode and no real funds collected.

Stable provider idempotency IDs reuse the same attempt on retries. An unresolved creation older than 15 minutes is held for Admin reconciliation rather than silently issuing another charge. Do not manually delete an attempt unless its provider transaction has been reconciled. Stored tax/toll/tip amounts are frozen for browser clients after checkout starts; Admin changes are detected before settlement. Existing unrestricted legacy Admin ride-write permissions remain unchanged and trusted.

No live payments, refunds, payouts, disputes, physical GoPayment devices, unattended card charging, or production ACH settlement have been enabled. A successful sandbox charge is not production readiness.

## Verification

Run:
node --test --test-isolation=none functions/*.test.js ride-tax.test.mjs receipt-toll-items.test.mjs

The 25 focused tests pass with mocked provider responses. Eight additional handler tests pass with in-memory Firebase and mocked provider adapters, covering authenticated ownership, server totals, idempotent retries, cancellation, amount changes and test-only receipt writes. Run those with `npm run test:integration --prefix functions`. Firestore payment rules tests are supplied at tests/towing-rules/payment-rules.test.mjs; run them on port 8085 with the Firestore emulator. That emulator's JAR download was previously blocked here with HTTP 403 Domain forbidden, so its rules were not execution-tested in this workspace. Merchant-specific end-to-end testing and browser verification have not been completed because no provider credentials or correct return URL are configured.

## Official references

https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted
https://docs.stripe.com/api/checkout/sessions/create
https://developer.paypal.com/studio/checkout/standard/integrate
https://developer.intuit.com/app/developer/qbpayments/docs/get-started
https://quickbooks.intuit.com/learn-support/en-us/help-article/process-credit-card-payments/process-payments-gopayment-app/L0XaYTJWZ_US_en_US
