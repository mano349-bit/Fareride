export const TOLL_ACCOUNTING = 'separate-v1';
const cents=value=>Math.round((Number(value)||0)*100);
export function tollAmount(ride){
 const value=Number(ride.tollsAmount ?? ride.tolls ?? 0);
 return Number.isFinite(value)&&value>=0?Math.round(value*100)/100:0;
}
export function riderTotal(ride){
 const base=ride.totalFare!=null?Number(ride.totalFare):ride.fare!=null?Number(ride.fare)+Number(ride.tipAmount||0):NaN;
 return Number.isFinite(base)?(cents(base)+(ride.tollAccounting===TOLL_ACCOUNTING?cents(tollAmount(ride)):0))/100:null;
}
export function tollUpdate(ride,uid,event,id){
 if(!uid||ride.driverId!==uid||!['started','arrived','completed'].includes(ride.status))throw Error('Tolls can only be recorded for your ongoing or completed ride.');
 if(ride.tollAccounting!==TOLL_ACCOUNTING&&tollAmount(ride)>0)throw Error('This ride has older toll records. Ask FareRide Admin to reconcile them before adding tolls.');
 if(!Number.isFinite(event.amount)||event.amount<=0||event.amount>500||Math.abs(event.amount*100-Math.round(event.amount*100))>0.00001)throw Error('Enter a toll amount from $0.01 to $500.00 with at most two decimals.');
 if(!event.location?.trim()||event.location.length>200)throw Error('Enter the toll road or booth name (up to 200 characters).');
 const next=cents(tollAmount(ride))+cents(event.amount);if(next>50000)throw Error('Tolls above $500 require FareRide Admin review.');
 return {tollsAmount:next/100,tollAccounting:TOLL_ACCOUNTING,lastTollId:id};
}
