import test from 'node:test';
import assert from 'node:assert/strict';
import {focusIdentity,captureViewFocus,restoreViewFocus} from '../src/view-focus.js';
function button(form){return {id:'',type:'submit',dataset:{},closest:selector=>selector==='[data-ws-form]'?{dataset:{wsForm:form}}:null,focus(){this.focused=true;}};}
function root(old,replacement){return {ownerDocument:{activeElement:old},contains:el=>el===old,querySelectorAll:()=>[replacement]};}
test('a rebuilt Save balances button retains logical keyboard focus',()=>{const old=button('balances'),next=button('balances'),r=root(old,next),saved=captureViewFocus(r);r.contains=()=>false;restoreViewFocus(r,saved);assert(next.focused);});
test('focus cannot move to a different form or timer action',()=>{const a=button('balances'),b=button('ops');assert.notDeepEqual(focusIdentity(a),focusIdentity(b));const timer=id=>({dataset:{wsAction:'timer'},closest:()=>({dataset:{wsTimer:'research',wsId:id}})});assert.notDeepEqual(focusIdentity(timer('13')),focusIdentity(timer('14')));});
test('a removed or disabled action uses an explicit safe fallback',()=>{const old=button('balances'),next=button('balances'),fallback=button('close'),r=root(old,next),saved=captureViewFocus(r);r.contains=()=>false;next.disabled=true;restoreViewFocus(r,saved,fallback);assert(fallback.focused);assert(!next.focused);});
test('text selection is restored and outside focus is left alone',()=>{const old={id:'search',selectionStart:1,selectionEnd:3,selectionDirection:'forward'},next={id:'search',focus(){this.focused=true;},setSelectionRange(...args){this.selection=args;}},r=root(old,next),saved=captureViewFocus(r);r.contains=()=>false;restoreViewFocus(r,saved);assert.deepEqual(next.selection,[1,3,'forward']);assert.equal(captureViewFocus(r),null);});
