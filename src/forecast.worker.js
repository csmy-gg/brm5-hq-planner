import {forecast} from './engine.js';
import {DATA} from './full-data.js';
self.onmessage=({data:{id,profile,at,visit}})=>{try{self.postMessage({id,result:forecast(profile,DATA,at,160,visit)});}catch(error){self.postMessage({id,error:error.message});}};
