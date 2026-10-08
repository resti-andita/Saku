import 'server-only';
import {admin} from './supabase';
export async function readLedger(){const {data,error}=await admin().from('ledgers').select('data,version').eq('id','main').maybeSingle();if(error)throw error;return data as {data:string;version:number}|null;}
export async function saveLedger(data:string,version:number|null){const c=admin();const result=version===null?await c.from('ledgers').upsert({id:'main',data,version:1},{onConflict:'id',ignoreDuplicates:true}).select('id'):await c.from('ledgers').update({data,version:version+1}).eq('id','main').eq('version',version).select('id');if(result.error)throw result.error;return !!result.data?.length;}
export async function receiptById(id:string){const {data,error}=await admin().from('receipts').select('*').eq('id',id).eq('ready',true).maybeSingle();if(error)throw error;return data;}
