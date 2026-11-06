import {createHash} from 'node:crypto';
export const METHODS = {stripe:'Credit / debit card (Stripe)',saved_card:'Card on file (Stripe)',paypal:'PayPal',intuit_card:'Intuit / GoPayment card',intuit_ach:'Intuit eCheck / ACH'};
export const PROVIDER = {stripe:'stripe',saved_card:'stripe',paypal:'paypal',intuit_card:'intuit',intuit_ach:'intuit'};
export function requireValue(ok,message,code=400){if(!ok){const error=new Error(message);error.status=code;throw error;}}
const amount=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
export function paymentQuote(ride){
 requireValue(ride?.status==='completed','Payment is available after the job is completed.');
 requireValue(ride.pricingStatus!=='quote_required'&&amount(ride.fare),'The final fare must be recorded first.');
 requireValue((ride.rideTax?.source==='driver-confirmed'&&amount(ride.rideTax.amount))||(!ride.rideTax&&amount(ride.taxAmount)),'Ask the driver to record the verified tax first (including 0% if exempt).');
 const base=ride.totalFare??(Number(ride.fare)+Number(ride.tipAmount||0));requireValue(amount(base),'The saved total is invalid.');
 const toll=ride.tollAccounting==='separate-v1'?Number(ride.tollsAmount??ride.tolls??0):0;
 const tax=ride.rideTax?.source==='driver-confirmed'?ride.rideTax.amount:0;
 requireValue(amount(toll)&&amount(tax),'The recorded toll or tax amount is invalid.');
 const cents=Math.round(Number(base)*100)+Math.round(toll*100)+Math.round(tax*100);
 requireValue(Number.isSafeInteger(cents)&&cents>=50&&cents<=100000000,'The total must be between $0.50 and $1,000,000.');
 return {cents,currency:'usd',fingerprint:createHash('sha256').update(JSON.stringify([ride.riderId,ride.driverId,ride.fare,ride.tipAmount,base,toll,tax,cents])).digest('hex')};
}
export function validateMethod(method){requireValue(Boolean(PROVIDER[method]),'Choose a supported payment method.');return PROVIDER[method];}
export function validId(id){requireValue(typeof id==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(id),'Invalid job ID.');return id;}
export function assertSettlement(verified,attempt){
 requireValue(verified.provider===attempt.provider&&verified.reference===attempt.reference,'Payment reference does not match.',409);
 requireValue(verified.cents===attempt.cents&&verified.currency.toLowerCase()===attempt.currency,'Payment amount or currency does not match.',409);
 requireValue(verified.testOnly===true,'Live payments are disabled in this test integration.',409);
 requireValue(verified.paid===true,'The provider has not confirmed payment.',409);
}
export function publicAttempt(a){return a?{id:a.id,method:a.method,methodLabel:METHODS[a.method],state:a.state,cents:a.cents,currency:a.currency,testOnly:true,url:a.url||null,reference:a.reference||null}:null;}

export function stripeSettlement(session,attempt){
 requireValue(session.metadata?.attemptId===attempt.id&&session.client_reference_id===attempt.rideId,'Stripe session does not match this job.',409);
 return {provider:'stripe',reference:session.id,testOnly:session.livemode===false,paid:session.payment_status==='paid',cents:session.amount_total,currency:session.currency,providerStatus:session.payment_status};
}
