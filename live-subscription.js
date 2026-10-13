// Keep realtime listeners, with server checks when a mobile/proxy connection stalls.
export function createLiveSubscriber({listen, read, visible, online, listenEvent, setTimer=setTimeout, clearTimer=clearTimeout, interval=10000}) {
 return function subscribe(reference, ...args) {
  const options = typeof args[0] === 'function' ? {} : args.shift();
  const [next, error] = args;
  let stopped=false, terminal=false, stopListener=null, timer=null, revision=0, reading=false, retry=1000;
  const cleanups=[];
  function schedule(delay=interval) { clearTimer(timer); if(!stopped&&!terminal)timer=setTimer(check,delay); }
  function report(problem) {
   if(stopped)return;
   if(['permission-denied','unauthenticated','failed-precondition','invalid-argument'].includes(problem.code)) {
    terminal=true;clearTimer(timer);stopListener?.();stopListener=null;error?.(problem);
   }
  }
  function deliver(snapshot) { if(!stopped&&!terminal){revision++;next(snapshot);} }
  function start() {
   if(stopped||terminal||!online()||!visible())return;
   stopListener?.();stopListener=null;
   const generation=++revision;
   listenerGeneration=generation;
   stopListener=listen(reference,options,snapshot=>{if(!stopped&&generation===listenerGeneration){retry=1000;deliver(snapshot);}},problem=>{
    if(stopped||generation!==listenerGeneration)return;
    stopListener=null;report(problem);
    if(!terminal){schedule(retry);retry=Math.min(retry*2,10000);}
   });
  }
  let listenerGeneration=0;
  async function check() {
   if(stopped||terminal)return;
   if(!visible()||!online()){schedule();return;}
   if(!stopListener)start();
   if(reading){schedule();return;}
   reading=true;const expected=revision;
   try { const snapshot=await read(reference);if(expected===revision)deliver(snapshot); }
   catch(problem){report(problem);}
   finally {reading=false;schedule();}
  }
  function reconnect() {
   if(stopped||terminal||!visible()||!online())return;
   start();check();
  }
  cleanups.push(listenEvent('online',reconnect),listenEvent('focus',reconnect),listenEvent('visibilitychange',reconnect));
  start();schedule();
  return ()=>{stopped=true;revision++;clearTimer(timer);stopListener?.();cleanups.forEach(cleanup=>cleanup());};
 };
}
