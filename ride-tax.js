import {US_STATE_TAX_TABLE,TAX_TABLE_SOURCE} from './sales-tax-data.js';
export {TAX_TABLE_SOURCE};
// Workbook state rates are the user-selected calculation defaults; local averages are never used as exact local rates.
export const TAX_REVIEWED = '2026-11-06';
export const SALES_SOURCE = 'https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/';
export const STATES = US_STATE_TAX_TABLE.map(row=>[row.code,row.name,row.stateRate]);

export const RIDE_RULES = {
 LA:{rate:1,fixed:0,note:'State TNC assessment: 1% of gross trip fare. Local fees may also apply; confirm the full charge.',source:'https://www.legis.la.gov/legis/Law.aspx?d=1148463'},
 NY:{rate:4,fixed:0,note:'4% TNC assessment only for trips starting outside NYC and ending in New York State. NYC and other surcharges require separate review.',source:'https://www.tax.ny.gov/bus/tnc/assessment.htm'},
 CT:{rate:0,fixed:0.30,note:'TNC fee: $0.30 per ride originating in Connecticut. Confirm any additional applicable fees.',source:'https://portal.ct.gov/drs/taxes/transportation-network-co/tax-information'},
 NV:{rate:3,fixed:0,note:'3% of total fare, including applicable fees and surcharges. Enter the full taxable base below.',source:'https://www.leg.state.nv.us/nrs/NRS-372B.html'}
};
export function stateCode(value){const v=String(value||'').toUpperCase().replace(/^US-/, '');return STATES.find(s=>s[0]===v||s[1].toUpperCase()===v)?.[0]||null;}
export function validPoint(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;}
let geocodeQueue=Promise.resolve();
let lastLookup=0;
async function lookupSlot(){const next=geocodeQueue.then(async()=>{const delay=Math.max(0,1100-(Date.now()-lastLookup));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));lastLookup=Date.now();});geocodeQueue=next.catch(()=>{});return next;}
export async function reverseTaxLocation(point,fetcher=fetch){
 if(!validPoint(point))return null;
 const url=new URL('https://nominatim.openstreetmap.org/reverse');
 url.search=new URLSearchParams({format:'jsonv2',lat:String(point.lat),lon:String(point.lng),zoom:'10',addressdetails:'1'});
 if(fetcher===fetch)await lookupSlot();
 const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Location lookup unavailable. Select the state manually.');
 const {address:a}=await response.json();if(!a?.country_code)return null;
 return {country:a.country_code.toUpperCase(),state:a.country_code==='us'?stateCode(a['ISO3166-2-lvl4']||a.state):null,city:a.city||a.town||a.county||''};
}
export async function detectTaxJurisdiction(ride,fetcher=fetch){
 // Resolve pickup first; live locations are supporting evidence, never a replacement for a known pickup.
 const points=[['pickup',ride.pickupLocation],['rider',ride.riderLocation],['driver',ride.driverLocation]];
 const found=[];
 for(const [kind,point] of points){if(!validPoint(point))continue;try{const place=await reverseTaxLocation(point,fetcher);if(place)found.push({kind,...place});}catch{}}
 const selected=found.find(p=>p.kind==='pickup')||null;
 const conflict=selected&&found.some(p=>p.country!==selected.country||p.state!==selected.state);
 return {selected,found,conflict:Boolean(conflict)};
}
function numeric(value,label,max){if(value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>max)throw Error('Enter a valid '+label+'.');return Number(value);}
export function taxRecord(ride,uid,input){
 if(!uid||ride.driverId!==uid||ride.status!=='completed')throw Error('Only the assigned driver can record tax for a completed ride.');
 if(ride.rideTax||ride.taxAmount!=null||ride.taxRatePercent!=null)throw Error('Tax is already recorded. Contact FareRide Admin for corrections.');
 if(ride.pricingStatus==='quote_required'||ride.fare==null||!Number.isFinite(Number(ride.fare)))throw Error('A confirmed fare is required first.');
 const state=input.state==='OTHER'?'OTHER':stateCode(input.state);if(!state)throw Error('Select a state or Outside USA.');
 const jurisdiction=state==='OTHER'?String(input.jurisdiction||'').trim():STATES.find(s=>s[0]===state)[1];
 if(!jurisdiction||jurisdiction.length>120)throw Error('Enter the country / tax jurisdiction (up to 120 characters).');
 const rate=numeric(input.rate,'tax rate from 0 to 100%',100),fixed=numeric(input.fixed,'fixed fee from 0 to 500',500),base=numeric(input.base,'taxable base',1000000);
 if(Math.abs(base*100-Math.round(base*100))>0.00001||Math.abs(fixed*100-Math.round(fixed*100))>0.00001)throw Error('Amounts must have at most two decimal places.');
 if(input.confirmed!==true)throw Error('Confirm the applicable tax and rider agreement before saving.');
 const amount=Math.round((base*rate/100+fixed)*100)/100;
 return {state,jurisdiction,rate,base,fixed,amount,source:'driver-confirmed',recordedBy:uid,riderAgreed:true,reviewedOn:TAX_REVIEWED};
}
export function savedTaxAmount(ride){return ride.rideTax?.source==='driver-confirmed'&&Number.isFinite(ride.rideTax.amount)&&ride.rideTax.amount>=0?ride.rideTax.amount:0;}

// Pure preview: historical payments and saved tax are never overwritten by the table.
export function tableTaxPreview(ride,state,custom={}){
 if(ride.rideTax||ride.taxAmount!=null||ride.taxRatePercent!=null)return null;
 const code=state==='OTHER'?'OTHER':stateCode(state);
 const row=US_STATE_TAX_TABLE.find(r=>r.code===code);
 const rate=custom.rate===undefined?row?.stateRate:numeric(custom.rate,'tax rate from 0 to 100%',100);
 if(rate===undefined||!code||ride.pricingStatus==='quote_required'||ride.fare==null||!Number.isFinite(Number(ride.fare)))return null;
 const base=custom.base===undefined?Number(ride.fare):numeric(custom.base,'taxable base',1000000);
 const fixed=custom.fixed===undefined?0:numeric(custom.fixed,'fixed fee',500);
 const jurisdiction=code==='OTHER'?String(custom.jurisdiction||'Outside USA'):row.name;
 const tax=Math.round((base*rate/100+fixed)*100)/100;
 return {state:code,jurisdiction,rate,base,fixed,amount:tax,source:TAX_TABLE_SOURCE.fileName,effectiveDate:TAX_TABLE_SOURCE.effectiveDate};
}
