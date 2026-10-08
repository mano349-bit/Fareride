import {newRideTracker, rideAnnouncement} from './driver-alert-state.js';
const tracker = newRideTracker();
let audio, enabled = false, dismissTimer;
const controls = document.createElement('div');
controls.style.cssText = 'padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
const toggle = document.createElement('button');
toggle.type = 'button';toggle.textContent = 'Enable ride sounds';
toggle.style.cssText = 'background:#1473e6;color:white;padding:10px;border:0;border-radius:8px';
const status = document.createElement('span');status.textContent = 'New rides show a pop-up. Tap to enable sound and voice.';
controls.append(toggle,status);
document.getElementById('driverControls')?.parentElement.append(controls);
const popup = document.createElement('aside');popup.hidden = true;popup.setAttribute('role','status');popup.setAttribute('aria-live','polite');
popup.style.cssText = 'position:fixed;right:16px;bottom:20px;z-index:9999;max-width:min(360px,calc(100vw - 32px));padding:16px;background:white;border:2px solid #1473e6;border-radius:12px;box-shadow:0 5px 24px #0003';
const text = document.createElement('p');text.style.margin = '0 0 12px';
const view = document.createElement('button');view.type='button';view.textContent='View ride requests';view.onclick=()=>{document.getElementById('requestList')?.scrollIntoView({behavior:'smooth',block:'start'});popup.hidden=true;};
const close = document.createElement('button');close.type='button';close.textContent='Dismiss';close.style.marginLeft='8px';close.onclick=()=>popup.hidden=true;
popup.append(text,view,close);document.body.append(popup);
function chime() {
 if (!audio || audio.state !== 'running') return;
 const now = audio.currentTime;
 for(const [frequency,offset] of [[660,0],[880,0.18]]) {
  const oscillator=audio.createOscillator(), gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(0,now+offset);gain.gain.linearRampToValueAtTime(0.045,now+offset+0.025);gain.gain.exponentialRampToValueAtTime(0.001,now+offset+0.28);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now+offset);oscillator.stop(now+offset+0.3);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }
}
function speak(message) {
 if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
 window.speechSynthesis.cancel();
 const utterance = new SpeechSynthesisUtterance(message);utterance.lang='en-US';utterance.volume=0.6;utterance.rate=0.95;window.speechSynthesis.speak(utterance);
}
toggle.onclick = async () => {
 if(enabled) {enabled=false;window.speechSynthesis?.cancel();toggle.textContent='Enable ride sounds';status.textContent='Ride pop-ups remain on. Sounds muted.';return;}
 try {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('Audio unavailable');
  audio ||= new Audio();
  // Start both APIs in the tap handler required by mobile browsers.
  const resumed = audio.resume();speak('Ride alerts enabled.');await resumed;
  enabled=true;chime();toggle.textContent='Mute ride sounds';status.textContent='Soft chime and spoken ride alerts enabled.';
 } catch {status.textContent='Sound could not start. Tap again. Ride pop-ups remain on.';}
};
export function notifyNewRides(rides,service,fromCache) {
 const fresh=tracker.update(rides,service,fromCache);if(!fresh.length)return;
 const message=rideAnnouncement(fresh[0]);text.textContent=message+(fresh.length>1 ? ` ${fresh.length} new rides are available.` : '');popup.hidden=false;
 clearTimeout(dismissTimer);dismissTimer=setTimeout(()=>popup.hidden=true,20000);
 if(enabled) {try{chime();speak(message);}catch{status.textContent='New ride available. Tap Enable ride sounds if audio is blocked.';}}
}
export function resetRideAlerts() {tracker.reset();popup.hidden=true;clearTimeout(dismissTimer);window.speechSynthesis?.cancel();}
