const valueDate=value=>{const date=value?.toDate?value.toDate():new Date(value||NaN);return Number.isFinite(date.getTime())?date.toISOString():null;};
export function receiptTollItems(records){
 return records.filter(record=>!['pending','rejected'].includes(record.status)
  && Number.isFinite(Number(record.amount))&&Number(record.amount)>0
  && ((record.source==='driver-rider-agreed'&&record.customerAgreed===true)||record.source==='driver-confirmed'||record.status==='approved'))
 .map(record=>({id:String(record.id),location:String(record.location||'Toll road / booth not recorded'),amount:Math.round(Number(record.amount)*100)/100,date:valueDate(record.createdAt)}))
 .sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.id.localeCompare(b.id));
}
