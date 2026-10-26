// Enlarge small dark text once; retain existing warning and service colors.
const adjusted=new WeakSet();let queued=false;
function improve(){
 queued=false;const changes=[];
 for(const element of document.body.querySelectorAll('*')){
  if(adjusted.has(element)||element.closest('script,style,svg,.leaflet-container,[aria-hidden="true"]')||!['INPUT','TEXTAREA','SELECT'].includes(element.tagName)&&![...element.childNodes].some(node=>node.nodeType===3&&node.textContent.trim()))continue;
  const style=getComputedStyle(element),size=parseFloat(style.fontSize),rgb=style.color.match(/[\d.]+/g)?.map(Number);
  if(!rgb||rgb.length>3&&rgb[3]===0||size>16||size<=0)continue;
  const channels=rgb.slice(0,3),dark=Math.max(...channels)<160&&Math.max(...channels)-Math.min(...channels)<65;
  if(dark)changes.push({element,size});
 }
 for(const {element,size} of changes){adjusted.add(element);element.style.setProperty('font-size',size*1.5+'px','important');element.style.setProperty('color','#075fd8','important');element.style.setProperty('line-height','1.45');}
}
const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(improve);}};
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
schedule();
