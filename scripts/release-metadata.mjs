import {randomUUID} from 'node:crypto';

export function releaseMetadata(revision=''){
 const commit=/^[a-f0-9]{40}$/i.test(revision)?revision.slice(0,12):'build';
 return {format:1,id:commit+'-'+randomUUID()};
}
