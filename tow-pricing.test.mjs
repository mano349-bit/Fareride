import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTowFare} from './tow-pricing.js';
test('standard tow is hookup plus loaded miles, rounded to cents',()=>{
 assert.equal(calculateTowFare(0),112);assert.equal(calculateTowFare(5),142);assert.equal(calculateTowFare(10),172);assert.equal(calculateTowFare(12.34),186.04);
});
test('invalid or negative tow distances cannot produce fares',()=>{
 for(const value of [-1,NaN,Infinity,null,'10'])assert.throws(()=>calculateTowFare(value),/valid towing distance/);
});
