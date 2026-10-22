import {defineConfig} from 'vite';
import {releaseMetadata} from './scripts/release-metadata.mjs';
import fs from 'node:fs';

export default defineConfig(({command})=>{
 const version=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8')).version;
 const release={...releaseMetadata(process.env.VERCEL_GIT_COMMIT_SHA),version};
 return {
  define:{__HQ_RELEASE_ID__:JSON.stringify(command==='build'?release.id:'development'),__HQ_APP_VERSION__:JSON.stringify(version)},
  plugins:[{name:'hq-release-metadata',generateBundle(){
   this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify(release)+'\n'});
  }}]
 };
});
