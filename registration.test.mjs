import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { registrationErrorMessage } from './registration-errors.js';

function harness(options = {}) {
  const elements = new Map(), records = new Map(), uploads = [];
  const user = { uid: 'test-uid', emailVerified: false };
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: id === 'ssnLast4' ? '0000' : id.includes('Password') ? 'example-password' : 'Example', files: [{ name: 'test.jpg', size: 10, type: id.endsWith('PortraitFile') || id === 'vehicleFrontFile' ? 'image/jpeg' : 'application/pdf' }], textContent: '', disabled: false, classList: { add() {}, remove() {} }, addEventListener() {}, reset() {} });
    return elements.get(id);
  };
  el('riderFacePhotoFile').files = [];
  if (options.profile) records.set('users/test-uid', options.profile);
  const context = vm.createContext({ registrationErrorMessage, prepareDriverPhoto: async () => { if (options.photoError) throw new Error('Unable to prepare a photo.'); return 'data:image/jpeg;base64,YQ=='; }, console: { log() {}, error() {} }, Date, Math, URL,
    window: { location: { href: 'https://mano349-bit.github.io/Fareride/registration.html' } },
    document: { getElementById: el }, auth: {}, db: {}, storage: {},
    doc: (_, collection, id) => `${collection}/${id}`, ref: (_, path) => path,
    getDoc: async path => ({ exists: () => records.has(path), data: () => records.get(path) }),
    setDoc: async (path, data) => { if (options.databaseError) throw Object.assign(new Error('Denied'), { code: 'permission-denied' }); records.set(path, { ...records.get(path), ...data }); },
    createUserWithEmailAndPassword: async () => ({ user }), signInWithEmailAndPassword: async () => ({ user }),
    uploadBytes: async (path) => { uploads.push(path); if (options.rejectPhotoUploads && /driver-portrait|vehicle-front/.test(path)) throw Object.assign(new Error('Photo denied'), {code:'storage/unauthorized'}); if (options.uploadError) throw Object.assign(new Error('Denied'), { code: 'storage/unauthorized' }); },
    sendEmailVerification: async (_, settings) => { context.returnUrl = settings.url; if (options.emailError) throw Object.assign(new Error('Domain'), { code: 'auth/unauthorized-continue-uri' }); }
  });
  const source = fs.readFileSync(new URL('./registration.js', import.meta.url), 'utf8').replace(/^\uFEFF/, '').replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  return { el, records, uploads, context, submit: role => vm.runInContext(role === 'driver' ? 'submitDriver({preventDefault(){}})' : 'submitRider({preventDefault(){}})', context) };
}

for (const role of ['rider', 'driver']) {
  test(`${role} application survives verification email failure and uses the live role login URL`, async () => {
    const h = harness({ emailError: true });
    await h.submit(role);
    assert.equal(h.records.get(`users/test-uid`).accountStatus, 'pending');
    assert.equal(h.records.get(`${role}Applications/${role}_test-uid`).status, 'new');
    assert.equal(h.context.returnUrl, `https://mano349-bit.github.io/Fareride/${role}-login.html`);
    assert.match(h.el(role === 'rider' ? 'riderApplicationMessage' : 'applicationMessage').textContent, /verification email delivery failed/);
  });
  test(`${role} upload failure exposes its step and code without claiming success`, async () => {
    const h = harness({ uploadError: true });
    await h.submit(role);
    assert.match(h.el(role === 'rider' ? 'riderApplicationMessage' : 'applicationMessage').textContent, /storage\/unauthorized/);
    assert.equal(h.records.has(`${role}Applications/${role}_test-uid`), false);
    assert.equal(h.el(role === 'rider' ? 'submitRiderBtn' : 'submitApplicationBtn').disabled, false);
  });
}
test('registration cannot change the role of an existing account', async () => {
  const h = harness({ profile: { role: 'driver', accountStatus: 'suspended' } });
  await h.submit('rider');
  assert.equal(h.records.get('users/test-uid').role, 'driver');
  assert.equal(h.records.get('users/test-uid').accountStatus, 'suspended');
  assert.match(h.el('riderApplicationMessage').textContent, /driver account/);
});
test('retry preserves existing approval state', async () => {
  const h = harness({ profile: { role: 'driver', accountStatus: 'approved', approved: true } });
  await h.submit('driver');
  assert.equal(h.records.get('users/test-uid').accountStatus, 'approved');
  assert.equal(h.records.get('users/test-uid').approved, true);
});
test('database failure is distinguished from an upload failure', async () => {
  const h = harness({ databaseError: true });
  await h.submit('rider');
  assert.match(h.el('riderApplicationMessage').textContent, /saving your account profile; code: permission-denied/);
});

for (const invalid of [[], [{name:'file.pdf',type:'application/pdf',size:10}], [{name:'large.jpg',type:'image/jpeg',size:10*1024*1024}]]) {
 test('driver application rejects missing, PDF or oversized photos before account creation: '+JSON.stringify(invalid), async()=>{
  const h=harness();h.el('driverPortraitFile').files=invalid;await h.submit('driver');
  assert.equal(h.records.size,0);assert.match(h.el('applicationMessage').textContent,/Both driver and vehicle photos are required/);
 });
}
test('driver photos save privately without requiring new Storage upload paths',async()=>{
 const h=harness({rejectPhotoUploads:true});await h.submit('driver');const docs=h.records.get('driverApplications/driver_test-uid').documents;
 assert.equal(docs.driverPortrait.path,undefined);assert.equal(docs.vehicleFront.path,undefined);
 assert.equal(h.uploads.length,3);assert.ok(h.uploads.every(path=>!/driver-portrait|vehicle-front/.test(path)));
 assert.equal(docs.vehicleFront.image,'data:image/jpeg;base64,YQ==');
 assert.equal(docs.driverPortrait.image,'data:image/jpeg;base64,YQ==');
});

test('rider registration does not require driver or vehicle photos',async()=>{
 const h=harness();h.el('driverPortraitFile').files=[];h.el('vehicleFrontFile').files=[];
 await h.submit('rider');assert.equal(h.records.get('riderApplications/rider_test-uid').status,'new');
});


test('rider face photo is prepared and saved privately with the application',async()=>{
 const h=harness();h.el('riderFacePhotoFile').files=[{name:'my-face.png',type:'image/png',size:1024}];
 await h.submit('rider');
 const application=h.records.get('riderApplications/rider_test-uid');
 assert.equal(application.status,'new');
 assert.equal(application.documents.riderPortrait.originalName,'my-face.png');
 assert.equal(application.documents.riderPortrait.contentType,'image/jpeg');
 assert.equal(application.documents.riderPortrait.image,'data:image/jpeg;base64,YQ==');
 assert.equal(application.documents.riderPortrait.path,undefined);
 assert.equal(h.uploads.length,1);
 assert.match(h.uploads[0],/driver-license/);
});

test('rider registration remains available without a face photo',async()=>{
 const h=harness();await h.submit('rider');
 assert.equal(h.records.get('riderApplications/rider_test-uid').documents.riderPortrait,undefined);
});

for(const file of [{name:'face.pdf',type:'application/pdf',size:10},{name:'large.jpg',type:'image/jpeg',size:10*1024*1024},{name:'empty.jpg',type:'image/jpeg',size:0}]){
 test('invalid rider face photo is rejected before account creation: '+file.name,async()=>{
  const h=harness();h.el('riderFacePhotoFile').files=[file];await h.submit('rider');
  assert.equal(h.records.size,0);assert.equal(h.uploads.length,0);
  assert.match(h.el('riderApplicationMessage').textContent,/Face photo must be an image under 10 MB/);
 });
}

test('unreadable rider face photo does not create a partial account or claim success',async()=>{
 const h=harness({photoError:true});h.el('riderFacePhotoFile').files=[{name:'broken.jpg',type:'image/jpeg',size:10}];
 await h.submit('rider');assert.equal(h.records.size,0);assert.equal(h.uploads.length,0);
 assert.match(h.el('riderApplicationMessage').textContent,/Unable to prepare a photo/);
 assert.equal(h.el('submitRiderBtn').disabled,false);
});
