export function plannedStartText(step,visitTime){
 const seconds=Math.max(0,Math.round(((step?.at??visitTime)-visitTime)/1000));
 if(!seconds)return 'Start when ready.';
 const delay=seconds<60?seconds+'s':Math.floor(seconds/60)+'m'+(seconds%60?' '+seconds%60+'s':'');
 return 'Follow-up · about '+delay+' into this visit. Confirm completed prerequisites first.';
}
export function plannedDelivery(row){
 return row?.delivery||(row?.sold?{resource:2,quantity:row.sold,value:row.sold*150}:null);
}
export function plannedDeliveryText(row,money){
 const shipment=plannedDelivery(row);if(!shipment)return 'No delivery suggested.';
 return shipment.quantity+' '+['CM','PM','Fuel','Equipment'][shipment.resource]+' → '+money(shipment.value);
}
export function productionBufferText(buffer){
 if(!buffer?.extra)return '';
 const duration=hours=>{const minutes=Math.ceil(hours*60);return Math.floor(minutes/60)+'h '+minutes%60+'m';};
 return 'Raid / injury buffer: '+buffer.extra+' extra '+(buffer.extra===1?'worker':'workers')+'. The same planned stock is reached in about '+duration(buffer.bufferedHours)+' instead of '+duration(buffer.minimumHours)+'. Storage stays capped; record actual injuries and losses after a raid.';
}
export function replenishmentText(shipment){
 const test=shipment?.replenishment;if(!test)return '';
 return 'Fuel replacement check: about '+Math.floor(test.fuel)+' Fuel by the next visit, even with '+test.workerLoss+' assigned Operations staff unavailable from the start. Protects '+Math.ceil(test.protectedFuel)+' Fuel for research and retained stock. This assumes the suggested assignments and recorded uptime; larger losses can require a new plan.';
}
export function storageWarning(row,used,capacity,now,date){
 if(capacity>0&&used>=capacity)return used>capacity?'':'Recorded storage is already full. Make room to resume production.';
 if(row?.storageFullAt==null)return '';
 const at=date(row.storageFullAt);
 return row.storageFullAt<=now?'Storage is estimated to have filled at '+at+'. Check your current stock; production stops while storage is full.':
  'Production is estimated to fill storage at '+at+'. Consider checking in before then. Based on recorded assignments and your uptime estimate.';
}
