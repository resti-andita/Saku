import {sameOrigin} from '@/lib/request-security';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {admin} from '@/lib/supabase';
import {recordAccess} from '@/lib/team';
export const dynamic='force-dynamic';
export async function GET(){if(!await getChatGPTUser())return Response.json({error:'Silakan masuk kembali.'},{status:401});try{const {data,error}=await admin().from('team_access').select('*').order('last_seen',{ascending:false}).limit(200);if(error)throw error;return Response.json({members:data},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'Aktivitas anggota belum dapat dimuat.'},{status:503});}}
export async function POST(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'Silakan masuk kembali.'},{status:401});if(!sameOrigin(req))return Response.json({error:'Permintaan tidak diizinkan.'},{status:403});try{await recordAccess(user);return Response.json({ok:true});}catch(e){console.error(e);return Response.json({error:'Kunjungan belum dapat dicatat.'},{status:503});}}
