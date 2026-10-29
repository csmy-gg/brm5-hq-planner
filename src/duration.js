export function researchDuration(hours){
 if(hours===0)return 'Instant';
 const seconds=Math.max(1,Math.round(hours*3600));if(seconds<60)return seconds+'s';
 const minutes=Math.ceil(seconds/60),h=Math.floor(minutes/60),m=minutes%60;
 return (h?h+'h':'')+(h&&m?' ':'')+(m?m+'m':'');
}
