import {auth,db,collection,query,where,onSnapshot,onAuthStateChanged} from './firebase-session.js';
const $=id=>document.getElementById(id);
const role=location.pathname.includes('admin-')?'admin':location.pathname.includes('driver-')?'driver':'rider';
const labels={stripe:'Credit / debit card — Stripe',saved_card:'Card on file — Stripe',paypal:'PayPal',intuit_card:'Intuit / GoPayment — card',intuit_ach:'Intuit — eCheck / ACH'};
let user=null,config=null,selected='',attempt=null,stop=null,version=0,view=0,busy=false,quoteReady=false,returnHandled=false;
const returnProvider=new URLSearchParams(location.search).get('provider');
const initialRide=new URLSearchParams(location.search).get('ride');
const cash=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
function controls(){
 const connected=Boolean(config?.providers[$('method').value.startsWith('intuit')?'intuit':$('method').value==='paypal'?'paypal':'stripe']);
 $('pay').hidden=role!=='rider';$('saveCard').hidden=role!=='rider';
 $('pay').disabled=busy||!selected||!quoteReady||!connected||attempt?.state==='paid';
 $('saveCard').disabled=busy||!config?.providers.stripe;
 $('verify').disabled=busy||!attempt?.reference;
 $('intuitOperator').hidden=role!=='admin'||!attempt||attempt.method?.startsWith('intuit')!==true||attempt.state==='paid';
 $('chargeToken').disabled=busy||!$('tokenConsent').checked||!$('sandboxToken').value;
 $('method').disabled=busy||Boolean(attempt&&attempt.state!=='expired');
 $('cancelCheckout').hidden=role!=='rider'||attempt?.provider==='intuit'||!['stripe','saved_card'].includes(attempt?.method)||attempt?.state==='expired'||attempt?.state==='paid';
 $('cancelCheckout').disabled=busy;
}
async function api(path,data,method='POST'){
 const expected=user?.uid;const token=await user?.getIdToken();if(!token||user?.uid!==expected)throw Error('Sign in again.');
 const response=await fetch('/api/payments'+path,{method,headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(data)}:{})});
 let result;try{result=await response.json();}catch{throw Error('Payment service is not deployed yet. Ask FareRide Admin to complete payment setup.');}
 if(user?.uid!==expected)throw Error('Your signed-in account changed.');
 if(!response.ok)throw Error(result.error||'Payment request failed. Retry the same attempt.');return result;
}
async function load(){
 const current=++view;selected=$('job').value;attempt=null;quoteReady=false;controls();if(!selected)return;
 $('status').textContent='Loading the saved charges…';
 try{
  const result=await api('/status?rideId='+encodeURIComponent(selected),null,'GET');if(current!==view)return;
  $('jobDetails').textContent=(result.ride.riderName||'Rider')+' | '+result.ride.pickup+' → '+result.ride.dropoff+' | Job '+selected;
  $('amount').textContent=result.quote?'Saved total: '+cash(result.quote.cents):result.quoteError;
  quoteReady=Boolean(result.quote);attempt=result.attempt;
  if(attempt&&attempt.state!=='expired')$('method').value=attempt.method;
  $('status').textContent=attempt?.state==='paid'?'Test payment succeeded. No real funds were collected.':attempt?.method?.startsWith('intuit')?'Intuit test payment: '+attempt.state+'. FareRide Admin submits the authorized sandbox token. ACH submission is not settled payment.':attempt?'Test payment: '+attempt.state+'. Continue this same attempt to avoid duplicate payment.':'Choose a payment method. Finalize tips, tolls and verified tax before starting checkout.';
 }catch(error){if(current===view)$('status').textContent=error.message;}
 controls();
 if(role==='rider'&&!returnHandled&&attempt?.reference&&attempt.state!=='paid'&&((returnProvider==='paypal'&&attempt.method==='paypal')||(returnProvider==='stripe'&&['stripe','saved_card'].includes(attempt.method)))){returnHandled=true;action(()=>api('/verify',{rideId:selected}));}
}
async function action(task){
 if(busy)return;busy=true;const current=version,job=selected;controls();
 try{const result=await task();if(current!==version||job!==selected)return;
  if(result?.url){const url=new URL(result.url);if(url.protocol!=='https:'||!['checkout.stripe.com','www.sandbox.paypal.com'].includes(url.hostname))throw Error('Invalid checkout destination.');location.assign(url.href);return;}
  await load();if(result?.providerStatus&&result.state!=='paid')$('status').textContent='The provider reports '+result.providerStatus+'. Payment is not confirmed. ACH processing is not settled payment.';
 }catch(error){if(current===version)$('status').textContent=error.message;}
 finally{busy=false;controls();}
}
$('cancelCheckout').onclick=()=>action(()=>api('/stripe/expire',{rideId:selected}));
$('job').onchange=load;$('method').onchange=controls;
$('pay').onclick=()=>action(async()=>{
 const result=await api('/checkout',{rideId:selected,method:$('method').value});
 if(result.method?.startsWith('intuit'))$('status').textContent='Intuit sandbox request created. FareRide Admin must submit an authorized sandbox payment token. This is not a GoPayment app transaction.';
 return result;
});
$('verify').onclick=()=>action(()=>api('/verify',{rideId:selected}));
$('saveCard').onclick=()=>action(async()=>{if(!$('cardConsent').checked)throw Error('Confirm consent to save a test card with Stripe first.');return api('/stripe/setup',{consent:true});});
$('sandboxToken').oninput=$('tokenConsent').onchange=controls;
$('chargeToken').onclick=()=>action(async()=>{
 const token=$('sandboxToken').value;$('sandboxToken').value='';
 return api('/intuit/charge',{rideId:selected,token,consent:$('tokenConsent').checked});
});
$('home').href=role==='admin'?'admin.html':role==='driver'?'driver.html':'rider.html';
$('cardTools').hidden=role!=='rider';
onAuthStateChanged(auth,async next=>{
 const current=++version;view++;stop?.();stop=null;user=next;config=null;attempt=null;selected='';busy=false;quoteReady=false;returnHandled=false;$('job').replaceChildren();$('sandboxToken').value='';$('tokenConsent').checked=false;$('cardConsent').checked=false;
 $('status').textContent='Sign in from your '+role+' page to use payments.';controls();if(!next)return;
 try{
  config=await api('/config',null,'GET');if(current!==version)return;
  const source=role==='admin'?query(collection(db,'rides'),where('status','==','completed')):query(collection(db,'rides'),where(role+'Id','==',next.uid));
  const available=Object.entries(config.providers).filter(([,ready])=>ready).map(([provider])=>provider);
  $('connections').textContent='Configured for testing: '+(available.join(', ')||'none yet — merchant credentials must be configured');
  controls();
  stop=onSnapshot(source,snapshot=>{
   if(current!==version)return;
   const previous=selected;const rides=snapshot.docs.map(d=>({...d.data(),id:d.id})).filter(r=>r.status==='completed').sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
   $('job').replaceChildren();for(const ride of rides){const option=document.createElement('option');option.value=ride.id;option.textContent=(ride.pickup||'Pickup')+' → '+(ride.dropoff||'Destination')+' | '+ride.id;$('job').append(option);}
   const pick=rides.find(r=>r.id===previous)||rides.find(r=>r.id===initialRide)||rides[0];$('job').value=pick?.id||'';
   load();
  },()=>{$('status').textContent='Unable to load jobs for this account.';});
 }catch(error){if(current===version)$('status').textContent=error.message;}
});
window.addEventListener('pagehide',()=>{version++;view++;stop?.();$('sandboxToken').value='';});
