import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STATES,stateCode,taxRecord,detectTaxJurisdiction} from './ride-tax.js';
import {riderTotal,tollUpdate} from './toll-accounting.js';
import {receiptFolders,receiptFields} from './Receipts/receipt-data.js';
import {amounts} from './admin-financials.js';
const ride={id:'j',driverId:'d',riderId:'r',status:'completed',fare:28.33,totalFare:28.33,tipAmount:0};
const input={state:'NY',rate:'8.875',fixed:'0',base:'28.33',confirmed:true};
test('all 50 states plus DC; exact fractional references and state names',()=>{
 assert.equal(STATES.length,51);assert.equal(new Set(STATES.map(s=>s[0])).size,51);
 assert.equal(stateCode('US-NY'),'NY');assert.equal(stateCode('Louisiana'),'LA');assert.equal(stateCode('Ontario'),null);
 assert.equal(STATES.find(s=>s[0]==='NJ')[2],6.625);
});
test('round once; tax totals include saved tolls without inflating driver earnings',()=>{
 const tax=taxRecord(ride,'d',input);assert.equal(tax.amount,2.51);
 const taxed={...ride,rideTax:tax,...tollUpdate(ride,'d',{amount:5,location:'Bridge'},'x')};
 assert.equal(riderTotal(taxed),35.84);assert.equal(amounts(taxed).driver,26.25);
 const receipt=receiptFolders([taxed],'r','rider')[0];assert.equal(receipt.tax,2.51);assert.equal(receipt.taxJurisdiction,'New York');
 const fields=receiptFields(receipt);assert(fields.some(([k,v])=>k==='Tax jurisdiction'&&v==='New York'));assert(!fields.some(([k])=>k.includes('Louisiana tax')));
 assert.equal(receiptFolders([taxed],'d')[0].total,35.84);
});
test('flat trip fees and explicit zero differ from missing tax',()=>{
 const tax=taxRecord(ride,'d',{...input,state:'CT',rate:'0',fixed:'0.30'});assert.equal(tax.amount,.3);
 const zero=taxRecord(ride,'d',{...input,rate:'0'});assert.equal(zero.amount,0);
 assert.equal(receiptFolders([ride],'r','rider')[0].tax,null);
 assert.equal(receiptFolders([{...ride,rideTax:zero}],'r','rider')[0].tax,0);
});
test('blank, invalid, unauthorized, unconfirmed and duplicate records are rejected',()=>{
 for(const extra of [{rate:''},{rate:' '},{rate:'NaN'},{rate:-1},{rate:101},{base:'1.001'},{fixed:'0.001'},{confirmed:false},{state:''},{state:'OTHER',jurisdiction:''}])assert.throws(()=>taxRecord(ride,'d',{...input,...extra}));
 assert.throws(()=>taxRecord(ride,'other',input));assert.throws(()=>taxRecord({...ride,status:'started'},'d',input));
 assert.throws(()=>taxRecord({...ride,rideTax:{}},'d',input));assert.throws(()=>taxRecord({...ride,taxAmount:0},'d',input));
 assert.equal(taxRecord(ride,'d',{...input,state:'OTHER',jurisdiction:'Canada / Ontario',rate:'13'}).amount,3.68);
});
test('legacy taxes and missing values are never automatically added or retroactively recalculated',()=>{
 assert.equal(riderTotal({...ride,taxAmount:10}),28.33);assert.equal(riderTotal({...ride,totalFare:null,fare:null}),null);
});
test('pickup wins over conflicting rider and driver GPS; no pickup never implies jurisdiction',async()=>{
 const fetcher=async url=>({ok:true,json:async()=>({address:{country_code:'us','ISO3166-2-lvl4':new URL(url).searchParams.get('lat')==='40'?'US-NY':'US-NJ'}})});
 const result=await detectTaxJurisdiction({pickupLocation:{lat:40,lng:-74},riderLocation:{lat:41,lng:-74},driverLocation:{lat:42,lng:-74}},fetcher);
 assert.equal(result.selected.state,'NY');assert.equal(result.conflict,true);assert.equal(result.found.length,3);
 assert.equal((await detectTaxJurisdiction({driverLocation:{lat:42,lng:-74}},fetcher)).selected,null);
 assert.equal((await detectTaxJurisdiction({pickupLocation:{lat:90.1,lng:0}},fetcher)).selected,null);
});
test('network failure preserves manual selection rather than implying zero tax',async()=>{
 const result=await detectTaxJurisdiction({pickupLocation:{lat:40,lng:-74}},async()=>{throw Error('offline');});assert.equal(result.selected,null);
});

test('uploaded spreadsheet populates every state rate and preview without fabricating recorded tax',async()=>{
 const {tableTaxPreview,TAX_TABLE_SOURCE}=await import('./ride-tax.js');
 assert.equal(TAX_TABLE_SOURCE.fileName,'2026-Sales-Tax-Data.xlsx');assert.equal(TAX_TABLE_SOURCE.effectiveDate,'2026-01-01');
 for(const [code,name,rate]of STATES){const preview=tableTaxPreview(ride,code);assert.equal(preview.rate,rate);assert.equal(preview.jurisdiction,name);}
 const louisiana=tableTaxPreview(ride,'LA');assert.equal(louisiana.rate,5);assert.equal(louisiana.amount,1.42);
 assert.equal(tableTaxPreview(ride,'NY').amount,1.13);
 assert.equal(tableTaxPreview(ride,'OTHER',{rate:'13',jurisdiction:'Canada / Ontario'}).amount,3.68);
 assert.equal(tableTaxPreview({...ride,taxAmount:0},'NY'),null);
 assert.equal(tableTaxPreview({...ride,pricingStatus:'quote_required'},'LA'),null);
 assert.equal(tableTaxPreview(ride,null),null);
 const previewReceipt=receiptFolders([ride],'r','rider')[0];previewReceipt.calculatedTax=louisiana;
 const fields=receiptFields(previewReceipt);
 assert(fields.some(([label,value])=>label==='State tax rate (uploaded table)'&&value==='5%'));
 assert(fields.some(([label,value])=>label==='Calculated tax — not recorded / collected'&&value==='$1.42'));
 assert(fields.some(([label,value])=>label==='Calculated total including tax'&&value==='$29.75'));
 assert.equal(previewReceipt.tax,null);assert.equal(previewReceipt.total,28.33);assert.equal(riderTotal(ride),28.33);
});
