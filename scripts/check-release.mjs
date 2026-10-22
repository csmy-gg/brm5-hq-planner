import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const stable=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function compareVersions(a,b){
 if(!stable.test(a)||!stable.test(b))throw Error('Use a stable app version such as 1.1.0.');
 const x=a.split('.').map(BigInt),y=b.split('.').map(BigInt);
 for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;
 return 0;
}
export function validateRelease(pkg,lock,changelog,{baseVersion,appChanged=false}={}){
 const version=pkg.version;compareVersions(version,version);
 if(lock.version!==version||lock.packages?.['']?.version!==version)throw Error('Package and lockfile app versions must match.');
 const entries=[...changelog.matchAll(/^## \[([^\]]+)\] — (\d{4}-\d{2}-\d{2})\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
 if(entries[0]?.[1]!==version)throw Error('Prepend a dated changelog entry for app version '+version+'.');
 const seen=new Set();
 for(const [index,[,v,date,body]] of entries.entries()){
  compareVersions(v,v);if(seen.has(v))throw Error('Duplicate changelog version.');seen.add(v);
  if(index&&compareVersions(entries[index-1][1],v)<=0)throw Error('Keep changelog versions in newest-first order.');
  const at=new Date(date+'T12:00:00Z');if(!Number.isFinite(at.getTime())||at.toISOString().slice(0,10)!==date)throw Error('Invalid changelog date.');
  if(!/^- \S.+/m.test(body)||/\b(TODO|TBD|placeholder)\b/i.test(body))throw Error('Write descriptive bullet-point release notes.');
 }
 if(baseVersion&&appChanged&&compareVersions(version,baseVersion)<=0)throw Error('App changes require a version increase and new release notes.');
 return version;
}
export function checkRelease(root=process.cwd(),base=process.env.RELEASE_BASE){
 const read=name=>JSON.parse(fs.readFileSync(new URL(name,pathToFileURL(root+'/')),'utf8'));
 let comparison={};
 if(base&&!/^0+$/.test(base)){
  if(!/^[a-f0-9]{40}$/i.test(base))throw Error('Release base must be a full commit SHA.');
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
  const previous=JSON.parse(git(['show',base+':package.json']));
  const paths=git(['diff','--name-only',base,'HEAD']).trim().split(/\r?\n/);
  comparison={baseVersion:previous.version,appChanged:paths.some(p=>/^(src\/|public\/|scripts\/|index\.html$|privacy\.html$|package(?:-lock)?\.json$|vite\.config\.mjs$|vercel\.json$)/.test(p))};
 }
 return validateRelease(read('package.json'),read('package-lock.json'),fs.readFileSync(new URL('CHANGELOG.md',pathToFileURL(root+'/')),'utf8'),comparison);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log('Release notes verified for v'+checkRelease());}catch(error){console.error(error.message);process.exitCode=1;}
}
