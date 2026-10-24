// Native popover handles outside clicks, Escape and returning keyboard focus.
export function installFeedback(document=globalThis.document,window=globalThis.window){
 const button=document.getElementById('feedback-button'),panel=document.getElementById('feedback-panel');
 const position=()=>{
  if(!panel.matches(':popover-open'))return;
  const rect=button.getBoundingClientRect(),margin=12,gap=8;
  const width=panel.offsetWidth,height=panel.offsetHeight;
  const left=Math.max(margin,Math.min(rect.right-width,window.innerWidth-width-margin));
  const below=rect.bottom+gap;
  const top=below+height<=window.innerHeight-margin?below:Math.max(margin,rect.top-height-gap);
  panel.style.left=left+'px';panel.style.top=top+'px';
 };
 panel.addEventListener('toggle',position);
 window.addEventListener('resize',position);
 window.addEventListener('scroll',position,true);
}
