import test from 'node:test';
import assert from 'node:assert/strict';
import {shareDriverPhotos, applicationDriverPhotos} from './driver-photo-sharing.js';
const image='data:image/jpeg;base64,YQ==';
const application={documents:{driverPortrait:{image},vehicleFront:{image}},plateNumber:'ABC123',ssnLast4:'1234'};
function setup(overrides={}) {
 const writes=[];
 const options={ride:{id:'job',driverId:'d',status:'accepted'},uid:'d',isCurrent:()=>true,readShared:async()=>null,readApplication:async()=>application,writeShared:async value=>writes.push(value),...overrides};
 return {options,writes};
}
test('only the two intended images, plate and driver ID are shared',async()=>{
 const h=setup();assert.equal(await shareDriverPhotos(h.options),true);
 assert.deepEqual(h.writes,[{portrait:image,vehicle:image,plateNumber:'ABC123',driverId:'d'}]);
 assert.equal('documents' in h.writes[0],false);assert.equal('ssnLast4' in h.writes[0],false);
});
test('all active job types can share photos but completed, cancelled and unassigned jobs cannot',async()=>{
 for(const status of ['requested','accepted','started','arrived','completed','cancelled']){
  for(const serviceType of ['ride','tow']){
   const h=setup({ride:{id:'job',driverId:'d',status,serviceType}});
   assert.equal(await shareDriverPhotos(h.options),['accepted','started','arrived'].includes(status));
  }
 }
 const h=setup({ride:{id:'job',driverId:'other',status:'accepted'}});assert.equal(await shareDriverPhotos(h.options),false);assert.equal(h.writes.length,0);
});
test('an existing share is reused, and account or ride changes prevent late writes',async()=>{
 const existing=setup({readShared:async()=>({driverId:'d'})});assert.equal(await shareDriverPhotos(existing.options),true);assert.equal(existing.writes.length,0);
 let current=true;const stale=setup({isCurrent:()=>current,readApplication:async()=>{current=false;return application;}});
 assert.equal(await shareDriverPhotos(stale.options),false);assert.equal(stale.writes.length,0);
});
test('missing or invalid driver photos cannot publish application documents',async()=>{
 assert.equal(applicationDriverPhotos({documents:{driverLicense:{image}}}),null);
 const h=setup({readApplication:async()=>({documents:{driverLicense:{image}}})});
 await assert.rejects(shareDriverPhotos(h.options),/needs both/);assert.equal(h.writes.length,0);
});
