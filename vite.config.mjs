import {defineConfig} from 'vite';
import {releaseMetadata} from './scripts/release-metadata.mjs';

export default defineConfig(({command})=>{
 const release=releaseMetadata(process.env.VERCEL_GIT_COMMIT_SHA);
 return {
  define:{__HQ_RELEASE_ID__:JSON.stringify(command==='build'?release.id:'development')},
  plugins:[{name:'hq-release-metadata',generateBundle(){
   this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify(release)+'\n'});
  }}]
 };
});
