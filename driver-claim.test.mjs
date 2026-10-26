import test from 'node:test';
import assert from 'node:assert/strict';
import {claimDriverDetails} from './driver-claim.js';
test('missing or incomplete applications do not prevent creating claim details',()=>{
 assert.deepEqual(claimDriverDetails('d',{fullName:'Alex',phone:'555'}),{driverId:'d',driverName:'Alex',driverPhone:'555',vehicleYear:'',vehicleMake:'',vehicleModel:''});
 assert.equal(claimDriverDetails('d',{}, {status:'pending',vehicleMake:'Ford'}).vehicleMake,'Ford');
});
test('only public fields are copied and caller identity cannot be overridden',()=>{
 const result=claimDriverDetails('d',{fullName:'Alex'}, {driverId:'other',uid:'other',fullName:'Alex',ssnLast4:'1234',documents:{private:true},vehicleYear:2022});
 assert.equal(result.driverId,'d');assert.equal(result.vehicleYear,2022);assert.equal('ssnLast4' in result,false);assert.equal('documents' in result,false);
});
