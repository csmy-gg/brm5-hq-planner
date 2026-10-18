export const resourceNames=['Construction Materials','Precious Metals','Fuel','Equipment'];
export const resourceShort=['CM','PM','Fuel','E'];
export const resourceSymbols=['▦','◇','◒','⚙'];
export function resourceMarkup(values){return values.map((value,i)=>value?`<span class="resource-chip" data-resource="${i}" aria-label="${Number(value).toLocaleString('en-US')} ${resourceNames[i]}"><span aria-hidden="true">${resourceSymbols[i]}</span> ${Number((Math.round(value*10)/10).toFixed(1)).toLocaleString('en-US')} ${resourceShort[i]}</span>`:'').filter(Boolean).join(' ')||'<span class="muted">No resources</span>';}
