import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function harness(fetch){
 const source=fs.readFileSync('rider.js','utf8');const context=vm.createContext({URL,Number,console,fareRideFetchWithRetry:fetch});
 vm.runInContext(source.slice(source.indexOf('async function geocode('),source.indexOf('\n\nfunction calculateFare(')),context);return context;
}
const ny={lat:40.7588,lon:-73.968},fl={lat:25.9338,lon:-80.1438};
test('10022 to 33160 uses dedicated US ZIP lookup and a real driving-route fallback',async()=>{
 const requested=[];const route={distance:2080000,duration:75600};
 const h=harness(async url=>{requested.push(String(url));if(String(url).includes('api.zippopotam.us')){const p=String(url).endsWith('10022')?ny:fl;return{json:async()=>({places:[{latitude:String(p.lat),longitude:String(p.lon)}]})};}if(String(url).includes('router.project-osrm.org'))throw Error('Timeout');return {json:async()=>({code:'Ok',routes:[route]})};});
 const from=await h.geocode('10022'),to=await h.geocode('33160'),result=await h.getRoute(from,to);
 assert.equal(result.distance,2080000);assert.equal(result.duration,75600);assert.match(requested[3],/routed-car\/route\/v1\/driving\/-73.968,40.7588;-80.1438,25.9338/);assert.equal(requested.length,4);
});
test('ZIP+4 and leading zeros are preserved; unavailable ZIP service falls back to US postal search',async()=>{
 const urls=[];const h=harness(async input=>{const url=String(input);urls.push(url);if(url.includes('api.zippopotam.us'))throw Error('unavailable');return{json:async()=>[{lat:'40',lon:'-73'}]};});
 await h.geocode('00501-1234');assert.ok(urls[0].endsWith('/us/00501'));const url=new URL(urls[1]);assert.equal(url.searchParams.get('postalcode'),'00501');assert.equal(url.searchParams.get('countrycodes'),'us');
});
test('invalid primary route data falls back; both route services failing never invent mileage',async()=>{
 let requests=0;const h=harness(async()=>({json:async()=>++requests===1?{code:'Ok',routes:[{distance:'not a number',duration:50}]}:{code:'Ok',routes:[{distance:1000,duration:50}]}}));assert.equal((await h.getRoute(ny,fl)).distance,1000);
 const failed=harness(async()=>{throw Error('network unavailable');});await assert.rejects(failed.getRoute(ny,fl),/busy or unreachable/);
});
test('invalid coordinates and routes without road access are rejected',async()=>{
 const h=harness(async()=>({json:async()=>({code:'NoRoute'})}));await assert.rejects(h.getRoute(ny,fl),/No driving route/);await assert.rejects(h.getRoute({lat:NaN,lon:0},fl),/Invalid/);
});
