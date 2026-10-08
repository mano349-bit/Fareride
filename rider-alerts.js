import {acceptanceTracker, acceptanceAnnouncement, arrivalEstimate} from './rider-alert-state.js';
import {auth,onAuthStateChanged} from './firebase-session.js';
const tracker = acceptanceTracker();
let audio, enabled = false, dismissTimer, latestRide=null, utteranceRef, voiceTimer;const awaitingETA=new Set();
const recording = new Audio(new URL('./audio/rider-test.wav', import.meta.url));
recording.preload='auto';
function playRecording(accepted=false) {
 recording.src=new URL(accepted?'./audio/rider-accepted.wav':'./audio/rider-test.wav',import.meta.url).href;
 recording.currentTime=0;
 const playing=recording.play();
 playing?.catch(()=>{status.textContent='Tap Replay voice alert to hear the message. Check your phone media volume.';});
}
const controls = document.createElement('div');
controls.style.cssText = 'padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
const toggle = document.createElement('button');
toggle.type = 'button';toggle.textContent = 'Enable rider voice alerts';
toggle.style.cssText = 'background:#1473e6;color:white;padding:10px;border:0;border-radius:8px';
const status = document.createElement('span');status.textContent = 'Tap to test voice alerts. Requesting a ride also enables them; keep this page open.';
const replay=document.createElement('button');replay.type='button';replay.textContent='Replay voice alert';
replay.onclick=()=>{enabled=true;toggle.textContent='Mute ride sounds';playRecording(Boolean(latestRide?.driverId));};
recording.onplaying=()=>{status.textContent='Voice audio is playing. Adjust your phone media volume if silent.';};
controls.append(toggle,replay,status);
document.querySelector('main')?.prepend(controls);
const popup = document.createElement('aside');popup.hidden = true;popup.setAttribute('role','status');popup.setAttribute('aria-live','polite');
popup.style.cssText = 'position:fixed;right:16px;bottom:20px;z-index:9999;max-width:min(360px,calc(100vw - 32px));padding:16px;background:white;border:2px solid #1473e6;border-radius:12px;box-shadow:0 5px 24px #0003';
const text = document.createElement('p');text.style.margin = '0 0 12px';
const view = document.createElement('button');view.type='button';view.textContent='View my trip';view.onclick=()=>{document.getElementById('tripDetails')?.closest('section')?.scrollIntoView({behavior:'smooth',block:'start'});popup.hidden=true;};
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
 clearTimeout(voiceTimer);
 if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {playRecording(Boolean(latestRide?.driverId));return;}
 const utterance = new window.SpeechSynthesisUtterance(message);utteranceRef=utterance;utterance.lang='en-US';utterance.volume=1;utterance.rate=0.95;
 let started=false;
 utterance.onstart=()=>{started=true;clearTimeout(voiceTimer);status.textContent='Voice announcement is playing.';};
 utterance.onend=()=>{if(utteranceRef===utterance)utteranceRef=null;};
 utterance.onerror=event=>{clearTimeout(voiceTimer);if(event.error==='canceled'||event.error==='interrupted')return;playRecording(Boolean(latestRide?.driverId));};
 window.speechSynthesis.resume();window.speechSynthesis.speak(utterance);
 voiceTimer=setTimeout(()=>{if(!started && enabled){window.speechSynthesis.cancel();playRecording(Boolean(latestRide?.driverId));}},2500);
}
toggle.onclick = async () => {
 if(enabled) {enabled=false;clearTimeout(voiceTimer);recording.pause();window.speechSynthesis?.cancel();toggle.textContent='Enable rider voice alerts';status.textContent='Ride pop-ups remain on. Sounds muted.';return;}
 enabled=true;toggle.textContent='Mute ride sounds';
 // Unlock the same HTML audio element directly inside the user's tap.
 playRecording(Boolean(latestRide?.driverId));
 try {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(Audio) audio ||= new Audio();
  // Start both APIs in the tap handler required by mobile browsers.
  audio?.resume()?.then(()=>chime()).catch(()=>{});
 } catch { /* Voice playback remains independent of the chime API. */ }
};
function notifyAccepted(ride) {
 if(ride.riderId !== auth.currentUser?.uid) return;
 latestRide=ride;
 const accepted=tracker.update(ride);
 const etaReady=awaitingETA.has(ride.id) && ['accepted','started'].includes(ride.status) && arrivalEstimate(ride);
 if(!accepted && !etaReady)return;
 if(accepted && !arrivalEstimate(ride) && ride.status!=='arrived')awaitingETA.add(ride.id);else awaitingETA.delete(ride.id);
 const message=acceptanceAnnouncement(ride);text.textContent=message;popup.hidden=false;
 clearTimeout(dismissTimer);dismissTimer=setTimeout(()=>popup.hidden=true,20000);
 if(enabled){try{chime();recording.onended=()=>{recording.onended=null;if(enabled)speak(message);};playRecording(true);}catch{status.textContent='Driver accepted your ride. Tap Replay voice alert to hear it.';}}
}
window.addEventListener('fareride-ride-restored',event=>notifyAccepted(event.detail));
document.getElementById('requestBtn')?.addEventListener('click',()=>{if(!enabled)toggle.onclick();});
onAuthStateChanged(auth,user=>{latestRide=null;awaitingETA.clear();tracker.reset();popup.hidden=true;clearTimeout(dismissTimer);clearTimeout(voiceTimer);recording.pause();controls.hidden=!user;controls.style.display=user?"flex":"none";window.speechSynthesis?.cancel();});
