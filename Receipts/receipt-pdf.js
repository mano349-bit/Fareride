// Local PDF generation: receipt details never leave the signed-in browser.
export function pdfFromJpegs(pages){
 const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
 const add=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;parts.push(bytes);length+=bytes.length;};
 const object=(id,content)=>{offsets[id]=length;add(id+' 0 obj\n');content();add('\nendobj\n');};
 add('%PDF-1.4\n');
 object(1,()=>add('<< /Type /Catalog /Pages 2 0 R >>'));
 object(2,()=>add('<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>'));
 pages.forEach((page,i)=>{
  const id=3+i*3;
  object(id,()=>add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Image '+(id+1)+' 0 R >> >> /Contents '+(id+2)+' 0 R >>'));
  object(id+1,()=>{add('<< /Type /XObject /Subtype /Image /Width '+page.width+' /Height '+page.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+page.bytes.length+' >>\nstream\n');add(page.bytes);add('\nendstream');});
  const stream='q\n612 0 0 792 0 0 cm\n/Image Do\nQ\n';
  object(id+2,()=>add('<< /Length '+encoder.encode(stream).length+' >>\nstream\n'+stream+'endstream'));
 });
 const start=length,count=3+pages.length*3;add('xref\n0 '+count+'\n0000000000 65535 f \n');
 for(let id=1;id<count;id++)add(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
 add('trailer\n<< /Size '+count+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n');
 return new Blob(parts,{type:'application/pdf'});
}
export function receiptPDF(fields,note){
 const pages=[];let canvas,ctx,y;
 function newPage(){
  canvas=document.createElement('canvas');canvas.width=1224;canvas.height=1584;ctx=canvas.getContext('2d');
  if(!ctx)throw Error('PDF rendering is unavailable in this browser.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1224,1584);ctx.fillStyle='#0754b6';ctx.font='bold 40px Arial';ctx.fillText('FareRide Ride Receipt',72,88);
  ctx.strokeStyle='#ffdf00';ctx.lineWidth=6;ctx.strokeRect(60,115,1104,3);ctx.font='24px Arial';y=165;
 }
 function savePage(){
  const data=atob(canvas.toDataURL('image/jpeg',0.95).split(',')[1]);
  pages.push({width:canvas.width,height:canvas.height,bytes:Uint8Array.from(data,c=>c.charCodeAt(0))});
 }
 function line(text){
  if(y>1480){savePage();newPage();}
  ctx.fillStyle='#17202a';ctx.fillText(text,72,y);y+=34;
 }
 function wrapped(text){
  let current='';
  for(const character of String(text)){
   if(character==='\n'){line(current);current='';continue;}
   if(ctx.measureText(current+character).width>1080){line(current);current='';}
   current+=character;
  }
  if(current)line(current);
 }
 newPage();
 for(const [label,value] of fields){ctx.font='bold 24px Arial';wrapped(label);ctx.font='24px Arial';wrapped(value);y+=12;}
 ctx.font='22px Arial';wrapped(note);savePage();return pdfFromJpegs(pages);
}
