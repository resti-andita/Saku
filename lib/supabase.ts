import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createServerClient,type CookieOptions} from '@supabase/ssr';
import {cookies} from 'next/headers';
export function configured(){return !!(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.SAKU_ALLOWED_EMAILS);}
export function allowed(email:string){return (process.env.SAKU_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());}
export function admin(){if(!configured())throw Error('Konfigurasi penyimpanan belum lengkap.');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function authClient(){const jar=await cookies();return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookieOptions:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'},cookies:{getAll(){return jar.getAll()},setAll(items: {name:string;value:string;options:CookieOptions}[]){try{items.forEach(({name,value,options})=>jar.set(name,value,options))}catch{/* Refreshed by proxy during server rendering. */}}}});}
