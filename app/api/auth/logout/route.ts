import {authClient} from '@/lib/supabase';
import {sameOrigin} from '@/lib/request-security';
export async function POST(req:Request){if(!sameOrigin(req))return new Response('Ditolak',{status:403});await (await authClient()).auth.signOut();return new Response(null,{status:303,headers:{Location:'/login','Cache-Control':'no-store'}});}
