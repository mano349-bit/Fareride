window.FareRide = (() => {
  const KEYS = {
    users:'fr_users',
    rides:'fr_rides',
    pricing:'fr_pricing',
    current:'fr_current'
  };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const toast = text => {
    const el=document.querySelector('.toast');
    if(!el) return;
    el.textContent=text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),2200);
  };
  const tabs = () => {
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`[data-panel="${btn.dataset.tab}"]`)?.classList.add('active');
    }));
  };
  const currentUser = role => {
    let user=read(KEYS.current,null);
    if(!user || user.role!==role){
      user={id:Date.now(),role,name:`Demo ${role[0].toUpperCase()+role.slice(1)}`,email:`${role}@fareride.demo`};
      write(KEYS.current,user);
    }
    return user;
  };
  return {KEYS,read,write,toast,tabs,currentUser};
})();
