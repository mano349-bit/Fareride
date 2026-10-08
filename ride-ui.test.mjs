import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneNumber, vehicleIcon, authScope } from './ride-ui.js';
test('full phone numbers preserve all digits and international prefix',()=>{
 assert.equal(phoneNumber('(516) 376-4118'), '5163764118');
 assert.equal(phoneNumber('+44 20 7946 0958'), '+442079460958');
 assert.equal(phoneNumber('001 516 376 4118'), '+15163764118');
 assert.equal(phoneNumber('516-376-4118 ext 123'), '5163764118');
 assert.equal(phoneNumber('516'), '');
});
test('role sessions match login and destination pages and remain separate',()=>{
 for(const role of ['rider','driver','admin'])assert.equal(authScope('/Fareride/'+role+'-login.html'),authScope('/Fareride/'+role+'.html'));
 assert.notEqual(authScope('/rider.html'),authScope('/driver.html'));
});
test('vehicle icons are separate SVG shapes',()=>{
 assert.match(vehicleIcon('ride'), /<svg/);assert.notEqual(vehicleIcon('ride'),vehicleIcon('tow'));assert.notEqual(vehicleIcon('ride'),vehicleIcon('messenger'));
});
