import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptTollItems} from './Receipts/receipt-toll-items.js';
import {receiptFolders,receiptFields} from './Receipts/receipt-data.js';
import {tollUpdate,riderTotal} from './toll-accounting.js';
test('multiple tolls add cumulatively and appear individually on receipts',()=>{
 const base={id:'ride',driverId:'d',riderId:'r',status:'completed',fare:100,totalFare:100};
 const first={...base,...tollUpdate(base,'d',{amount:20,location:'Verrazzano Bridge'},'a')};
 const second={...first,...tollUpdate(first,'d',{amount:7.5,location:'Second toll'},'b')};
 assert.equal(second.tollsAmount,27.5);assert.equal(riderTotal(second),127.5);
 const items=receiptTollItems([{id:'b',amount:7.5,location:'Second toll',source:'driver-rider-agreed',customerAgreed:true,createdAt:'2026-10-28T13:00:00Z'},{id:'a',amount:20,location:'Verrazzano Bridge',source:'driver-rider-agreed',customerAgreed:true,createdAt:'2026-10-28T12:00:00Z'}]);
 assert.deepEqual(items.map(item=>item.id),['a','b']);
 const receipt={...receiptFolders([second],'r','rider')[0],tollItems:items,tollDetailsLoaded:true};
 const fields=receiptFields(receipt);assert(fields.some(([label,value])=>label.includes('Verrazzano Bridge')&&value.includes('$20.00')));assert(fields.some(([label,value])=>label.includes('Second toll')&&value.includes('$7.50')));
 assert.equal(receipt.total,127.5);
});
test('pending, rejected and invalid toll records never appear as charged items',()=>{
 const records=[{id:'pending',amount:20,status:'pending',source:'driver-submitted'},{id:'rejected',amount:20,status:'rejected',source:'driver-submitted'},{id:'bad',amount:-1,source:'driver-confirmed'},{id:'old',amount:5,source:'driver-confirmed'}];
 assert.deepEqual(receiptTollItems(records).map(item=>item.id),['old']);
});
test('missing itemized history preserves recorded total and explains missing details',()=>{
 const receipt={...receiptFolders([{id:'r',driverId:'d',riderId:'r',status:'completed',fare:100,totalFare:100,tollsAmount:20,tollAccounting:'separate-v1'}],'r','rider')[0],tollDetailsLoaded:true,tollItems:[]};
 assert.equal(receipt.total,120);assert(receiptFields(receipt).some(([label,value])=>label==='Toll details'&&value.includes('Only the total')));
});
