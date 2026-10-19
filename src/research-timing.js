export function researchCountdown(end,now=Date.now()){
 const seconds=Math.max(0,Math.ceil((end-now)/1000));
 if(!seconds)return 'Timer elapsed · power released · confirm completion in-game';
 if(seconds<60)return seconds+'s remaining';
 const minutes=Math.ceil(seconds/60);
 return Math.floor(minutes/60)+'h '+String(minutes%60).padStart(2,'0')+'m remaining';
}
