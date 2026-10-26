const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const boxes=new Map();
const tableStates=new WeakMap();
let scheduled=false,lastFrame=0;
function addBox(element,label,table=null){
  if(boxes.has(element))return;
  const state={table,hover:false,manual:false,position:0,holdUntil:performance.now()+2500};
  element.classList.add('table-text-box');
  element.addEventListener('mouseenter',()=>{state.hover=true;});
  element.addEventListener('mouseleave',()=>{state.hover=false;});
  element.addEventListener('wheel',()=>{state.manual=true;},{passive:true});
  element.addEventListener('touchstart',()=>{state.manual=true;},{passive:true});
  element.addEventListener('keydown',()=>{state.manual=true;});
  const expand=document.createElement('button');expand.type='button';expand.className='text-box-toggle';expand.textContent='Expand text';expand.setAttribute('aria-expanded','false');expand.hidden=true;
  expand.onclick=()=>{const open=element.classList.toggle('text-box-expanded');if(open){state.collapsedHeight=element.style.height||getComputedStyle(element).height;element.style.height='auto';}else element.style.height=state.collapsedHeight||'96px';expand.textContent=open?'Collapse text':'Expand text';expand.setAttribute('aria-expanded',String(open));state.manual=true;measure();};
  element.after(expand);state.expand=expand;
  state.label=label;boxes.set(element,state);resize.observe(element);
}
function measure(){
  for(const [box,state] of boxes){
    if(!box.isConnected){resize.unobserve(box);state.expand.remove();boxes.delete(box);continue;}
    if(!box.getClientRects().length)continue;
    if(document.body.classList.contains('admin-readable')&&!state.sized){state.sized=true;box.style.height=Math.min(96,Math.max(26,box.scrollHeight))+'px';box.style.maxHeight='none';}
    const overflow=box.scrollHeight>box.clientHeight+2;
    box.dataset.overflow=String(overflow);
    if(overflow)box.dataset.resizable='true';
    state.expand.hidden=true;
    if(overflow){box.tabIndex=0;box.setAttribute('role','region');box.setAttribute('aria-label',state.label+'; scroll to read all text');}
    else{box.removeAttribute('tabindex');box.removeAttribute('role');box.removeAttribute('aria-label');}
  }
}
const resize=new ResizeObserver(measure);
function fit(){
  scheduled=false;
  for(const table of document.querySelectorAll('table')){
    if(!tableStates.has(table)){
      table.classList.add('fit-table');if(table.querySelector('#ridesTable'))table.classList.add('operations-table');const state={paused:reducedMotion.matches};tableStates.set(table,state);
      const tools=document.createElement('div');tools.className='table-scroll-tools';
      const toggle=document.createElement('button');toggle.type='button';
      const update=()=>{toggle.textContent=state.paused?'Resume text scrolling':'Pause text scrolling';toggle.setAttribute('aria-pressed',String(state.paused));};
      toggle.onclick=()=>{state.paused=!state.paused;for(const [box,s] of boxes)if(s.table===table){s.manual=false;s.position=box.scrollTop;s.holdUntil=performance.now()+1500;}update();};update();
      const note=document.createElement('span');note.textContent='Long text scrolls slowly. Hover or focus to pause; scroll manually to read.';
      state.toggle=toggle;state.update=update;state.note=note;toggle.disabled=reducedMotion.matches;
      if(reducedMotion.matches)note.textContent='Automatic scrolling is off for reduced motion. Scroll text boxes manually.';
      tools.append(toggle,note);table.before(tools);
    }
    const headers=[...table.querySelectorAll('thead tr:last-child th')].map(th=>th.textContent.trim());
    for(const row of table.querySelectorAll('tbody tr,tfoot tr')){
      let column=0;
      for(const cell of row.cells){
        const label=headers[column] || 'Details';column+=cell.colSpan;
        cell.dataset.columnLabel=label;
        if(cell.dataset.fitText==='true')continue;cell.dataset.fitText='true';
        const details=cell.querySelector('.details-box,.earnings-job-summary');
        if(details){addBox(details,details.classList.contains('earnings-job-summary')?'Job information':'Ride details',table);continue;}
        if(table.classList.contains('operations-table'))continue;
        if(cell.querySelector('button,select,textarea,label'))continue;
        const box=document.createElement('div');
        for(const node of [...cell.childNodes])if(!(node.nodeType===1 && node.matches('input')))box.append(node);
        if(box.childNodes.length){cell.prepend(box);addBox(box,label,table);}
      }
    }
  }
  for(const element of document.querySelectorAll('[data-fit-long-text]'))addBox(element,'Ride information');
  measure();
}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(fit);}}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener('resize',schedule);
// Hidden detail rows and tabs need measurement when opened.
document.addEventListener('click',schedule);
reducedMotion.addEventListener('change',()=>{
  for(const table of document.querySelectorAll('table.fit-table')){
    const state=tableStates.get(table);if(!state)continue;
    if(reducedMotion.matches)state.paused=true;
    state.toggle.disabled=reducedMotion.matches;state.update();
    state.note.textContent=reducedMotion.matches?'Automatic scrolling is off for reduced motion. Scroll text boxes manually.':'Long text scrolls slowly. Hover or focus to pause; scroll manually to read.';
  }
});
function tick(now){
  const delta=Math.min((now-lastFrame)/1000,0.1);lastFrame=now;
  for(const [box,state] of boxes){
    if(!box.isConnected){resize.unobserve(box);boxes.delete(box);continue;}
    if(reducedMotion.matches||document.hidden||state.manual||state.hover||box.contains(document.activeElement)||tableStates.get(state.table)?.paused||!box.getClientRects().length||box.dataset.overflow!=='true'||now<state.holdUntil)continue;
    const max=box.scrollHeight-box.clientHeight;
    state.position=Math.min(max,state.position+delta*10);box.scrollTop=state.position;
    if(state.position>=max){state.position=0;state.holdUntil=now+5000;setTimeout(()=>{if(box.isConnected&&!state.manual&&!state.hover&&!box.contains(document.activeElement)&&!tableStates.get(state.table)?.paused)box.scrollTop=0;},5000);}
  }
  requestAnimationFrame(tick);
}
schedule();requestAnimationFrame(tick);
