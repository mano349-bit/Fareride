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
 const canvas=document.createElement('canvas');canvas.width=1224;canvas.height=1584;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('PDF rendering is unavailable in this browser.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1224,1584);
 const wrap=(value,width,font)=>{
  ctx.font=font;const lines=[];let line='';
  for(const character of String(value)){
   if(character==='\n'){lines.push(line);line='';continue;}
   if(line&&ctx.measureText(line+character).width>width){lines.push(line);line='';}
   line+=character;
  }
  lines.push(line);return lines;
 };
 const rows=fields.map(([label,value])=>({labels:wrap(label,350,'bold 22px Arial'),values:wrap(value,700,'22px Arial')}));
 const notes=wrap(note,1080,'20px Arial');
 const height=110+rows.reduce((sum,row)=>sum+Math.max(row.labels.length,row.values.length)*28+12,0)+28+notes.length*26;
 const scale=Math.min(1,1440/height);
 ctx.save();ctx.translate(72,72);ctx.scale(scale,scale);
 ctx.fillStyle='#0754b6';ctx.font='bold 36px Arial';ctx.fillText('FareRide Ride Receipt',0,36);
 ctx.strokeStyle='#ffdf00';ctx.lineWidth=5;ctx.strokeRect(0,58,1080,2);
 let y=100;
 for(const row of rows){
  ctx.fillStyle='#17202a';ctx.font='bold 22px Arial';row.labels.forEach((text,i)=>ctx.fillText(text,0,y+i*28));
  ctx.font='22px Arial';row.values.forEach((text,i)=>ctx.fillText(text,380,y+i*28));
  y+=Math.max(row.labels.length,row.values.length)*28+12;
 }
 y+=28;ctx.fillStyle='#475569';ctx.font='20px Arial';notes.forEach((text,i)=>ctx.fillText(text,0,y+i*26));ctx.restore();
 const data=atob(canvas.toDataURL('image/jpeg',0.95).split(',')[1]);
 return pdfFromJpegs([{width:canvas.width,height:canvas.height,bytes:Uint8Array.from(data,c=>c.charCodeAt(0))}]);
}
