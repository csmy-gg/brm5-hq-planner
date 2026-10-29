import {forecast} from './engine.js';
import {DATA} from './full-data.js';
self.onmessage=({data:{id,profile,at}})=>{try{self.postMessage({id,result:forecast(profile,DATA,at)});}catch(error){self.postMessage({id,error:error.message});}};
