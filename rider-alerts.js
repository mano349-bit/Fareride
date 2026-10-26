import {stageTracker} from './ride-stage-state.js?v=20261026-gps-stages';
import {auth,onAuthStateChanged} from './firebase-session.js';
const tracker=stageTracker();
let enabled=false,audio=null,latest=null,hideTimer;
const controls=document.createElement('div');controls.className='rider-voice-controls';controls.style.cssText='padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Enable rider voice alerts';
const replay=document.createElement('button');replay.type='button';replay.textContent='Replay voice alert';
const status=document.createElement('span');status.textContent='Enable sound once for live job-stage alerts. Keep this page open.';
controls.append(toggle,replay,status);document.querySelector('main')?.prepend(controls);
const popup=document.createElement('aside');popup.className='rider-stage-popup';popup.hidden=true;popup.setAttribute('role','status');popup.setAttribute('aria-live','polite');popup.setAttribute('aria-atomic','true');
const text=document.createElement('p'),close=document.createElement('button');close.type='button';close.textContent='Dismiss';close.onclick=()=>popup.hidden=true;popup.append(text,close);document.body.append(popup);
const style=document.createElement('style');style.textContent=`
.rider-stage-popup{position:fixed;top:22vh;left:50%;transform:translateX(-50%);z-index:10000;width:max-content;max-width:calc(100vw - 32px);padding:22px 26px;background:#f6fbff;border:2px solid #1677ff;border-radius:16px;text-align:center;box-shadow:0 0 22px #1677ff70,0 0 38px #16b66b40;animation:rider-stage-pop .35s ease-out}
.rider-stage-popup[hidden]{display:none}.rider-stage-popup p{margin:0 0 14px;color:#075fd8;font-size:clamp(22px,4vw,32px);line-height:1.4;font-weight:800;text-shadow:0 0 10px #1677ff45}.rider-stage-popup button{min-height:44px;padding:10px 18px;background:#0875e1;color:white;border:0;border-radius:8px;font-weight:700}
@keyframes rider-stage-pop{from{opacity:0;transform:translateX(-50%) scale(.92)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@media(prefers-reduced-motion:reduce){.rider-stage-popup{animation:none}}
`;document.head.append(style);
function chime(){
 if(!enabled||audio?.state!=='running')return;
 for(const [hz,delay] of [[660,0],[880,.18]]){const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;oscillator.type='sine';oscillator.frequency.value=hz;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.06,at+.025);gain.gain.exponentialRampToValueAtTime(.001,at+.28);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.3);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
}
function speak(message){
 if(!enabled)return;chime();
 if(window.speechSynthesis&&window.SpeechSynthesisUtterance){window.speechSynthesis.cancel();const voice=new SpeechSynthesisUtterance(message);voice.lang='en-US';voice.rate=.95;voice.onerror=()=>{status.textContent='Stage updated. Tap Replay voice alert if sound was blocked.';};window.speechSynthesis.speak(voice);}
}
function enable(){
 enabled=true;toggle.textContent='Mute ride sounds';
 try{const Context=window.AudioContext||window.webkitAudioContext;if(Context){audio ||= new Context();audio.resume().then(chime).catch(()=>{});}}catch{}
 status.textContent='Job-stage sounds enabled.';
}
toggle.onclick=()=>{if(enabled){enabled=false;toggle.textContent='Enable rider voice alerts';window.speechSynthesis?.cancel();status.textContent='Pop-ups remain enabled. Sound muted.';}else enable();};
replay.onclick=()=>{enable();if(latest)speak(latest);};
window.addEventListener('fareride-ride-restored',event=>{
 const ride=event.detail;if(!ride||ride.riderId!==auth.currentUser?.uid||ride.stageConfirmed===false)return;
 const message=tracker.update(ride);if(!message)return;
 latest=message;text.textContent=message;popup.hidden=true;void popup.offsetWidth;popup.hidden=false;clearTimeout(hideTimer);hideTimer=setTimeout(()=>popup.hidden=true,15000);speak(message);
});
document.getElementById('requestBtn')?.addEventListener('click',()=>{latest=null;popup.hidden=true;if(!enabled)enable();});
onAuthStateChanged(auth,user=>{tracker.reset();latest=null;popup.hidden=true;clearTimeout(hideTimer);window.speechSynthesis?.cancel();enabled=false;toggle.textContent='Enable rider voice alerts';controls.style.display=user?'flex':'none';});
