import {readPreferences,savePreferences,applyPreferences} from './preferences.js';
let preferences=readPreferences();
window.HQTheme={get:()=>preferences.theme,set:theme=>{preferences=savePreferences({...preferences,theme});applyPreferences(preferences);}};
for(const query of ['(prefers-color-scheme: dark)','(prefers-reduced-motion: reduce)'])matchMedia(query).addEventListener('change',()=>applyPreferences(readPreferences()));
applyPreferences(preferences);
