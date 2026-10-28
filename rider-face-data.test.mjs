import test from 'node:test';
import assert from 'node:assert/strict';
import {validRiderFace,canSeeRiderFace,faceCropRect,riderFaceProfile,ownRiderIdPath} from './rider-face-data.js';
const image='data:image/jpeg;base64,YQ==';
test('ID crop always stays square inside its source, including edge dragging and extreme size',()=>{
 for(const [width,height] of [[1000,600],[300,900]])for(const x of [-1,0,.5,1,2])for(const y of [-1,0,.5,1,2])for(const size of [-1,.1,.5,3]){
  const c=faceCropRect(width,height,x,y,size);assert.equal(c.width,c.height);assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=width+.01&&c.y+c.height<=height+.01);assert.ok(c.width<=Math.min(width,height)*.7);
 }
 assert.throws(()=>faceCropRect(0,500));assert.throws(()=>faceCropRect(600,400,NaN));
});
test('saved profile contains only a confirmed bounded JPEG crop and no ID document metadata',()=>{
 assert.deepEqual(riderFaceProfile('r',image,true,'now'),{uid:'r',image,updatedAt:'now'});
 assert.throws(()=>riderFaceProfile('r',image,false));
 for(const invalid of ['https://example.com/id.jpg','data:image/png;base64,YQ==','data:image/jpeg;base64,'+'A'.repeat(200000),null])assert.equal(validRiderFace(invalid),false);
});
test('only assigned active driver can display the crop',()=>{
 for(const status of ['requested','accepted','started','arrived','completed','cancelled']){
  const ride={driverId:'d',riderId:'r',status};assert.equal(canSeeRiderFace(ride,'d'),['accepted','started','arrived'].includes(status));assert.equal(canSeeRiderFace(ride,'other'),false);assert.equal(canSeeRiderFace(ride,null),false);
 }
});
test('saved ID loader accepts only this rider’s own private application path',()=>{
 const app=path=>({documents:{driverLicense:{path}}});
 assert.equal(ownRiderIdPath('r',app('riderApplications/rider_r/id.png')),'riderApplications/rider_r/id.png');
 for(const path of ['riderApplications/rider_other/id.png','driverApplications/driver_r/id.png','riderApplications/rider_r/nested/id.png','https://example.com/id.png'])assert.equal(ownRiderIdPath('r',app(path)),null);
});
