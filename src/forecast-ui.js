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
