import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret,defineString} from 'firebase-functions/params';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {randomUUID,createHash} from 'node:crypto';
import {METHODS,validateMethod,paymentQuote,validId,requireValue,assertSettlement,publicAttempt,stripeSettlement} from './payment-model.js';
import {providerAvailability,stripeClient,createPayPal,verifyPayPal,createIntuit,verifyIntuit} from './payment-providers.js';
initializeApp();
const db=getFirestore();
const paymentConfig=defineSecret('PAYMENT_SANDBOX_CONFIG');
const appOrigin=defineString('PAYMENT_APP_ORIGIN');
const attempts=db.collection('paymentSandboxAttempts');
const customerRefs=db.collection('paymentSandboxCustomers');
function config(){return JSON.parse(paymentConfig.value()||'{}');}
function origin(){const url=new URL(appOrigin.value());requireValue(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'A valid PAYMENT_APP_ORIGIN must be configured.',503);return url.origin;}
async function actor(req){
 const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];requireValue(token,'Sign in to use payments.',401);
 const decoded=await getAuth().verifyIdToken(token,true).catch(()=>null);requireValue(decoded,'Sign in again to use payments.',401);
 const [user,admin]=await Promise.all([db.doc('users/'+decoded.uid).get(),db.doc('admins/'+decoded.uid).get()]);
 const isAdmin=admin.data()?.active===true,profile=user.data();
 requireValue(isAdmin||(profile&&['active','approved'].includes(profile.accountStatus)),'An approved FareRide account is required.',403);
 return {uid:decoded.uid,role:isAdmin?'admin':profile.role};
}
function authorized(a,ride,operator=false){
 requireValue(a.role==='admin'||(operator?a.role==='driver'&&ride.driverId===a.uid:ride.riderId===a.uid||a.role==='driver'&&ride.driverId===a.uid),'This job is not available to your account.',403);
}
async function getRide(id,a,operator=false){validId(id);const snapshot=await db.doc('rides/'+id).get();requireValue(snapshot.exists,'Job not found.',404);const ride=snapshot.data();authorized(a,ride,operator);return ride;}
async function customer(a,c){
 const ref=customerRefs.doc(a.uid),snapshot=await ref.get();if(snapshot.data()?.stripeId)return snapshot.data().stripeId;
 const created=await stripeClient(c).customers.create({metadata:{fareRideUid:a.uid,testOnly:'true'}},{idempotencyKey:'fareride-test-customer-'+a.uid});
 await ref.set({stripeId:created.id,uid:a.uid},{merge:true});return created.id;
}
async function reserve(id,a,method){
 const provider=validateMethod(method),rideRef=db.doc('rides/'+validId(id)),ref=attempts.doc(id);
 return db.runTransaction(async tx=>{
  const [rideSnap,saved]=await Promise.all([tx.get(rideRef),tx.get(ref)]);requireValue(rideSnap.exists,'Job not found.',404);
  const ride=rideSnap.data();authorized(a,ride);const quote=paymentQuote(ride),previous=saved.data();
  requireValue(!ride.paymentStatus||!['paid','succeeded','completed'].includes(String(ride.paymentStatus).toLowerCase()),'This job already has a recorded payment.',409);
  if(previous&&previous.state!=='expired'){
   requireValue(previous.state!=='paid','A successful test payment is already recorded for this job.',409);
   requireValue(previous.fingerprint===quote.fingerprint,'Charges changed. Ask Admin to reconcile the existing checkout before paying again.',409);
   requireValue(previous.method===method,'Continue the existing payment method to avoid a duplicate payment.',409);
   return previous;
  }
  const attempt={id:randomUUID(),rideId:id,uid:ride.riderId,driverId:ride.driverId,method,provider,...quote,state:'initializing',testOnly:true,createdMillis:Date.now(),createdAt:FieldValue.serverTimestamp(),checkoutExpiresAt:Math.floor(Date.now()/1000)+1800};
  if(previous){tx.create(db.collection('paymentSandboxArchive').doc(previous.id),previous);tx.set(ref,attempt);}else tx.create(ref,attempt);tx.update(rideRef,{sandboxPaymentLock:true,sandboxPayment:{method:METHODS[method],status:'Test checkout started — payment unconfirmed',provider,reference:'Pending',amount:quote.cents/100,currency:'USD',testOnly:true}});return attempt;
 });
}
async function attemptFor(id,a){const ride=await getRide(id,a),snapshot=await attempts.doc(id).get();requireValue(snapshot.exists,'No payment attempt exists for this job.',404);return {ride,attempt:snapshot.data()};}
async function persistReference(attempt,values){
 return db.runTransaction(async tx=>{const ref=attempts.doc(attempt.rideId),snap=await tx.get(ref);requireValue(snap.data()?.id===attempt.id,'Payment attempt changed.',409);if(snap.data().state==='paid')return snap.data();tx.update(ref,{...values,state:'pending',updatedAt:FieldValue.serverTimestamp()});if(values.reference)tx.update(db.doc('rides/'+attempt.rideId),{'sandboxPayment.reference':values.reference});return {...snap.data(),...values,state:'pending'};});
}
async function settle(attempt,verified){
 assertSettlement(verified,attempt);
 await db.runTransaction(async tx=>{
  const ref=attempts.doc(attempt.rideId),rideRef=db.doc('rides/'+attempt.rideId);
  const [snap,rideSnap]=await Promise.all([tx.get(ref),tx.get(rideRef)]);const current=snap.data();
  requireValue(current?.id===attempt.id,'Payment attempt changed.',409);
  if(current.state==='paid')return;
  // The amount is tied to the saved receipt, never to client-submitted price fields.
  requireValue(paymentQuote(rideSnap.data()).fingerprint===attempt.fingerprint,'Saved charges changed; Admin reconciliation is required.',409);
  tx.update(ref,{state:'paid',providerStatus:verified.providerStatus||'succeeded',verifiedAt:FieldValue.serverTimestamp()});
  tx.update(rideRef,{sandboxPaymentLock:true,sandboxPayment:{method:METHODS[attempt.method],status:'Test payment succeeded — no real funds collected',provider:attempt.provider,reference:attempt.reference,amount:attempt.cents/100,currency:'USD',testOnly:true}});
 });
 return {...publicAttempt(attempt),state:'paid'};
}
async function verifyAttempt(attempt,c,capture=false){
 if(attempt.state==='paid')return publicAttempt(attempt);
 requireValue(attempt.reference,'The checkout has not been created yet. Retry the same payment method.',409);
 let verified;
 if(attempt.provider==='stripe'){
  const session=await stripeClient(c).checkout.sessions.retrieve(attempt.reference);
  verified=stripeSettlement(session,attempt);
 }else if(attempt.provider==='paypal')verified=await verifyPayPal(c,attempt,capture);
 else verified=await verifyIntuit(c,attempt);
 if(!verified.paid){await attempts.doc(attempt.rideId).update({providerStatus:verified.providerStatus||'pending'});return {...publicAttempt(attempt),state:'pending',providerStatus:verified.providerStatus||'pending'};}
 return settle(attempt,verified);
}
export const paymentsApi=onRequest({region:'us-central1',secrets:[paymentConfig],timeoutSeconds:60,maxInstances:10},async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
 const path=req.path.replace(/^\/api\/payments/,'');
 try{
  const c=config();
  if(path==='/stripe/webhook'){
   requireValue(req.method==='POST','Use POST.',405);requireValue(c.stripeWebhookSecret,'Stripe webhook is not configured.',503);
   const stripe=stripeClient(c);let event;
   try{event=stripe.webhooks.constructEvent(req.rawBody,req.headers['stripe-signature'],c.stripeWebhookSecret);}catch{throw Object.assign(new Error('Invalid webhook signature.'),{status:400});}
   requireValue(event.livemode===false,'Live payment events are not accepted.',400);
   if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    const session=event.data.object;
    if(session.mode==='payment'&&session.metadata?.rideId){
     const saved=await attempts.doc(validId(session.metadata.rideId)).get(),attempt=saved.data();
     requireValue(attempt&&attempt.id===session.metadata.attemptId,'Unknown checkout session.',409);
     // A webhook can arrive before checkout creation returns; store only the matching signed session.
     if(!attempt.reference){attempt.reference=session.id;await persistReference(attempt,{reference:session.id,url:session.url||null});}
     requireValue(attempt.reference===session.id,'Checkout reference mismatch.',409);
     await verifyAttempt(attempt,c);
    }
   }
   return res.json({received:true});
  }
  if(req.headers.origin)requireValue(req.headers.origin===origin(),'This payment request came from an unsupported website.',403);
  const a=await actor(req);
  if(path==='/config'&&req.method==='GET')return res.json({testOnly:true,providers:providerAvailability(c),role:a.role});
  if(path==='/stripe/setup'&&req.method==='POST'){
   requireValue(a.role==='rider','Saved cards are managed by the rider account.',403);requireValue(req.body?.consent===true,'Confirm consent to save a test card.');
   const stripe=stripeClient(c),customerId=await customer(a,c);
   await customerRefs.doc(a.uid).set({cardSaveConsentAt:FieldValue.serverTimestamp(),cardSaveConsentVersion:'2026-11-06'},{merge:true});
   const session=await stripe.checkout.sessions.create({mode:'setup',customer:customerId,payment_method_types:['card'],success_url:origin()+'/rider-payments.html?saved=1',cancel_url:origin()+'/rider-payments.html',metadata:{uid:a.uid,testOnly:'true'}});
   return res.json({url:session.url,testOnly:true});
  }
  const id=validId(req.body?.rideId||req.query.rideId);
  if(path==='/status'&&req.method==='GET'){
   const ride=await getRide(id,a),snapshot=await attempts.doc(id).get();let quote=null,quoteError='';try{quote=paymentQuote(ride);}catch(error){quoteError=error.message;}
   return res.json({ride:{id,pickup:ride.pickup||'',dropoff:ride.dropoff||'',driverName:ride.driverName||'',riderName:ride.riderName||''},quote,quoteError,attempt:publicAttempt(snapshot.data()),testOnly:true});
  }
  requireValue(req.method==='POST','Use POST.',405);
  if(path==='/checkout'){
   requireValue(a.role==='rider','Only the rider can start online checkout.',403);
   const provider=validateMethod(req.body.method);requireValue(providerAvailability(c)[provider],'This payment provider has not been connected for testing.',503);
   let attempt=await reserve(id,a,req.body.method);
   if(attempt.reference||attempt.provider==='intuit')return res.json(publicAttempt(attempt));
   requireValue(Date.now()-attempt.createdMillis<900000,'This unfinished attempt needs Admin reconciliation before another provider request.',409);
   if(provider==='stripe'){
    const stripe=stripeClient(c),customerId=await customer(a,c);
    if(attempt.method==='saved_card'){const cards=await stripe.paymentMethods.list({customer:customerId,type:'card',limit:1});requireValue(cards.data.length,'Save a test card first, or choose Credit / debit card.');}
    const session=await stripe.checkout.sessions.create({mode:'payment',customer:customerId,payment_method_types:['card'],client_reference_id:id,metadata:{rideId:id,attemptId:attempt.id},line_items:[{price_data:{currency:'usd',unit_amount:attempt.cents,product_data:{name:'FareRide test payment — '+id}},quantity:1}],success_url:origin()+'/rider-payments.html?ride='+encodeURIComponent(id)+'&provider=stripe',cancel_url:origin()+'/rider-payments.html?ride='+encodeURIComponent(id),expires_at:attempt.checkoutExpiresAt},{idempotencyKey:attempt.id});
    attempt=await persistReference(attempt,{reference:session.id,url:session.url});
   }else attempt=await persistReference(attempt,await createPayPal(c,attempt,origin()));
   return res.json(publicAttempt(attempt));
  }
  if(path==='/intuit/charge'){
   const ride=await getRide(id,a,true);requireValue(a.role==='admin','Only FareRide Admin can submit sandbox payment tokens.',403);
   requireValue(req.body.consent===true,'Confirm customer authorization for this test payment.');
   const {attempt}=await attemptFor(id,a);requireValue(attempt.provider==='intuit','The rider must first choose an Intuit payment method.');
   requireValue(paymentQuote(ride).fingerprint===attempt.fingerprint,'Job charges changed.',409);
   if(!attempt.reference){
    requireValue(Date.now()-attempt.createdMillis<900000,'This unfinished Intuit attempt needs Admin reconciliation before retrying.',409);
    requireValue(typeof req.body.token==='string','Enter an Intuit sandbox payment token.');
    const tokenHash=createHash('sha256').update(req.body.token).digest('hex');
    await db.runTransaction(async tx=>{const ref=attempts.doc(id),saved=await tx.get(ref);requireValue(!saved.data().tokenHash||saved.data().tokenHash===tokenHash,'Retry with the same test token to avoid a duplicate payment.',409);tx.update(ref,{tokenHash});});
    const created=await createIntuit(c,attempt,req.body.token);await persistReference(attempt,created);attempt.reference=created.reference;}
   return res.json(await verifyAttempt(attempt,c));
  }
  if(path==='/stripe/expire'){
   requireValue(a.role==='rider','Only the rider can cancel checkout.',403);
   const {attempt}=await attemptFor(id,a);requireValue(attempt.provider==='stripe'&&attempt.reference&&attempt.state!=='paid','No open Stripe checkout to cancel.',409);
   const stripe=stripeClient(c);let session=await stripe.checkout.sessions.retrieve(attempt.reference);
   if(session.status==='open')session=await stripe.checkout.sessions.expire(attempt.reference);
   requireValue(session.status==='expired'&&session.livemode===false,'Checkout cannot be cancelled because payment may have completed. Check payment status.',409);
   await db.runTransaction(async tx=>{const ref=attempts.doc(id),snap=await tx.get(ref);requireValue(snap.data()?.id===attempt.id&&snap.data().state!=='paid','Payment status changed.',409);tx.update(ref,{state:'expired'});tx.update(db.doc('rides/'+id),{sandboxPaymentLock:false,'sandboxPayment.status':'Test checkout expired — no payment confirmed'});});
   return res.json({...publicAttempt(attempt),state:'expired'});
  }
  if(path==='/verify'){
   const {attempt}=await attemptFor(id,a);requireValue(a.role==='rider'||a.role==='admin'||attempt.provider==='intuit','Only the rider can confirm online checkout.',403);
   return res.json(await verifyAttempt(attempt,c,attempt.provider==='paypal'));
  }
  throw Object.assign(new Error('Payment endpoint not found.'),{status:404});
 }catch(error){
  const status=Number.isInteger(error.status)?error.status:500;
  res.status(status).json({error:status<500||error.status?error.message:'Payment service unavailable. Retry the same attempt; do not start another payment.',testOnly:true});
 }
});
