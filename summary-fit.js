const summary=document.getElementById('summary');
if(summary){
 let queued=false;
 function fit(){
  queued=false;if(summary.hidden||summary.clientWidth===0)return;
  summary.style.setProperty('font-size','24px','important');
  const style=getComputedStyle(summary),items=[...summary.children];
  const available=summary.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);
  const gap=parseFloat(style.columnGap)||0;
  const textWidth=items.reduce((sum,item)=>sum+item.getBoundingClientRect().width,0);
  const room=available-gap*Math.max(0,items.length-1);
  if(textWidth>room&&room>0)summary.style.setProperty('font-size',(Math.floor(24*room/textWidth*100)/100)+'px','important');
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(fit);}}
 new ResizeObserver(schedule).observe(summary);
 new MutationObserver(schedule).observe(summary,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
 if(document.fonts)document.fonts.ready.then(schedule);
 window.addEventListener('resize',schedule);
 schedule();
}
