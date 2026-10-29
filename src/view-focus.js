// Preserve the logical control when a recorded action rebuilds a view.
export function focusIdentity(element){
 if(!element)return null;
 if(element.id)return {kind:'id',id:element.id};
 const timer=element.closest?.('[data-ws-timer]');
 if(element.dataset?.wsAction)return {kind:'action',action:element.dataset.wsAction,id:element.dataset.wsId||'',timer:timer?.dataset.wsTimer||'',timerId:timer?.dataset.wsId||''};
 const form=element.closest?.('[data-ws-form]');
 if(form&&element.type==='submit')return {kind:'submit',form:form.dataset.wsForm};
 return null;
}
export function captureViewFocus(root){const element=root.ownerDocument.activeElement;if(!root.contains(element))return null;return {identity:focusIdentity(element),element,start:element.selectionStart,end:element.selectionEnd,direction:element.selectionDirection};}
export function restoreViewFocus(root,saved,fallback){
 if(!saved)return;
 let target=root.contains(saved.element)?saved.element:null;
 if(!target&&saved.identity){const key=JSON.stringify(saved.identity);target=[...root.querySelectorAll('button,input,select,textarea,a,summary,[tabindex]')].find(element=>JSON.stringify(focusIdentity(element))===key);}
 if(!target||target.disabled||target.hidden)target=fallback;
 if(!target)return;target.focus({preventScroll:true});
 if(target!==fallback&&Number.isInteger(saved.start)&&Number.isInteger(saved.end)&&typeof target.setSelectionRange==='function')try{target.setSelectionRange(saved.start,saved.end,saved.direction||'none');}catch{}
}
