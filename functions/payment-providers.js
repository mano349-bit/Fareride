import Stripe from 'stripe';
import {requireValue} from './payment-model.js';
const PAYPAL='https://api-m.sandbox.paypal.com';
const INTUIT='https://sandbox.api.intuit.com';
export function providerAvailability(config){return {stripe:Boolean(config.stripeSecret?.startsWith('sk_test_')),paypal:Boolean(config.paypalClientId&&config.paypalSecret),intuit:Boolean(config.intuitAccessToken&&config.intuitTokenExpiresAt>Date.now())};}
export function stripeClient(config){requireValue(providerAvailability(config).stripe,'Stripe test credentials have not been connected.',503);return new Stripe(config.stripeSecret,{timeout:15000,maxNetworkRetries:2});}
async function jsonFetch(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 const result=await response.json().catch(()=>({}));
 // Never send provider payloads, tokens, or card details to logs or browser errors.
 requireValue(response.ok,'The payment provider could not complete this request. Retry the same attempt or ask FareRide Admin to check the provider account.',502);
 return result;
}
async function paypalToken(config){
 requireValue(providerAvailability(config).paypal,'PayPal sandbox credentials have not been connected.',503);
 return (await jsonFetch(PAYPAL+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.paypalClientId+':'+config.paypalSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'})).access_token;
}
export async function createPayPal(config,attempt,origin){
 const token=await paypalToken(config);
 const order=await jsonFetch(PAYPAL+'/v2/checkout/orders',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','PayPal-Request-Id':attempt.id},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:attempt.id,custom_id:attempt.id,description:'FareRide test payment '+attempt.rideId,amount:{currency_code:'USD',value:(attempt.cents/100).toFixed(2)}}],application_context:{shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:origin+'/rider-payments.html?ride='+encodeURIComponent(attempt.rideId)+'&provider=paypal',cancel_url:origin+'/rider-payments.html?ride='+encodeURIComponent(attempt.rideId)}})});
 const url=order.links?.find(link=>link.rel==='approve')?.href;
 requireValue(order.id&&url&&new URL(url).hostname==='www.sandbox.paypal.com','The provider did not return a valid sandbox checkout.',502);
 return {reference:order.id,url};
}
export async function verifyPayPal(config,attempt,capture=false){
 const token=await paypalToken(config),url=PAYPAL+'/v2/checkout/orders/'+encodeURIComponent(attempt.reference);
 let order=await jsonFetch(url,{headers:{Authorization:'Bearer '+token}});
 if(capture&&order.status==='APPROVED')order=await jsonFetch(url+'/capture',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','PayPal-Request-Id':attempt.id+'-capture'},body:'{}'});
 const unit=order.purchase_units?.[0],payment=unit?.payments?.captures?.[0];
 requireValue(order.id===attempt.reference&&order.purchase_units?.length===1&&unit.custom_id===attempt.id,'PayPal returned a different order.',409);
 return {provider:'paypal',reference:order.id,testOnly:true,paid:order.status==='COMPLETED'&&payment?.status==='COMPLETED',cents:Math.round(Number(payment?.amount?.value??unit.amount.value)*100),currency:payment?.amount?.currency_code??unit.amount.currency_code,providerStatus:order.status};
}
export async function createIntuit(config,attempt,token){
 requireValue(providerAvailability(config).intuit,'A valid Intuit sandbox OAuth access token has not been connected.',503);
 requireValue(typeof token==='string'&&/^[A-Za-z0-9_-]{20,500}$/.test(token)&&!/^\d+$/.test(token),'Enter an Intuit sandbox payment token, never a card or bank-account number.');
 const ach=attempt.method==='intuit_ach';
 const result=await jsonFetch(INTUIT+'/quickbooks/v4/payments/'+(ach?'echecks':'charges'),{method:'POST',headers:{Authorization:'Bearer '+config.intuitAccessToken,'Content-Type':'application/json','Request-Id':attempt.id},body:JSON.stringify(ach?{amount:(attempt.cents/100).toFixed(2),token,paymentMode:'WEB'}:{amount:(attempt.cents/100).toFixed(2),currency:'USD',token,capture:true,context:{mobile:false,isEcommerce:true}})});
 requireValue(typeof result.id==='string','Intuit did not return a transaction reference.',502);return {reference:result.id};
}
export async function verifyIntuit(config,attempt){
 requireValue(providerAvailability(config).intuit,'Reconnect the expired Intuit sandbox access token.',503);
 const ach=attempt.method==='intuit_ach';
 const result=await jsonFetch(INTUIT+'/quickbooks/v4/payments/'+(ach?'echecks':'charges')+'/'+encodeURIComponent(attempt.reference),{headers:{Authorization:'Bearer '+config.intuitAccessToken,'Request-Id':attempt.id+'-verify'}});
 requireValue(result.id===attempt.reference,'Intuit transaction reference does not match.',409);
 // ACH submission is not settlement. Leave ACH processing pending for settlement reconciliation.
 return {provider:'intuit',reference:result.id,testOnly:true,paid:!ach&&result.status==='CAPTURED',cents:Math.round(Number(result.amount)*100),currency:result.currency||'USD',providerStatus:String(result.status||'PENDING')};
}
