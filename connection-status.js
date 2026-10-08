const banner=document.createElement('div');banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
banner.style.cssText='position:sticky;top:0;z-index:2000;padding:12px 18px;background:#fff3cd;color:#663c00;border:1px solid #e0be63;text-align:center;font-weight:700';
document.body.prepend(banner);
function update(){banner.hidden=navigator.onLine!==false;banner.textContent='You are offline. Ride status and live locations may be outdated. Reconnect before updating your ride.';}
window.addEventListener('offline',update);window.addEventListener('online',update);update();
