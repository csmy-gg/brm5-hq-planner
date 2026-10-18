import {loadEnv} from 'vite';
const e={...loadEnv('production',process.cwd(),''),...process.env};
const url=e.VITE_SUPABASE_URL?.trim(),key=e.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if(Boolean(url)!==Boolean(key))throw Error('Set both Supabase public values, or leave both empty for guest-only use.');
if(key?.startsWith('sb_secret_'))throw Error('A secret Supabase key must never be bundled.');
if(key?.split('.').length===3){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw Error('Only the anon legacy key is allowed.');}catch{throw Error('Invalid or privileged Supabase key.');}}
if(url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Use the hosted Supabase project URL.');
if(e.VERCEL_ENV==='preview'&&url&&(!e.VITE_PRODUCTION_SUPABASE_URL||url===e.VITE_PRODUCTION_SUPABASE_URL))throw Error('Preview must use a separate Supabase project. Leave preview credentials empty for guest-only previews.');
if(e.VERCEL_ENV==='production'&&url&&url!==e.VITE_PRODUCTION_SUPABASE_URL)throw Error('Production Supabase project must match the explicit production setting.');
