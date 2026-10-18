import catalog from './catalog.json' with {type:'json'};
// IDs are explicit and permanent. Reordering the catalogue never remaps progress.
export const DATA=catalog;
export function migrateResearchState(input){
 const s={...input,status:{...input.status}};
 for(const task of DATA.tasks){
  if(s.status[task.id])continue;
  const done=task.legacyIndices?.some(index=>s.legacy?.[index]===true);
  s.status[task.id]={state:done?'done':'todo'};
 }
 s.researchCatalogVersion=2;return s;
}
