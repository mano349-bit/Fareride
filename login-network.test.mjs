import test from 'node:test';import assert from 'node:assert/strict';import {withDeadline} from './login-network.js';
test('hung profile check becomes a retryable error without waiting forever',async()=>{
 await assert.rejects(withDeadline(new Promise(()=>{}),10),{code:'fareride/profile-timeout'});
});
test('successful profile check returns without waiting for deadline',async()=>{
 assert.equal(await withDeadline(Promise.resolve('profile'),100),'profile');
});
test('profile permission errors remain errors',async()=>{
 await assert.rejects(withDeadline(Promise.reject(new Error('permission denied')),100),/permission denied/);
});
