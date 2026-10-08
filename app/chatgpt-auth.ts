import {redirect} from 'next/navigation';
import {allowed,authClient,configured} from '@/lib/supabase';
// Compatibility names retain the existing application call sites; authentication is Supabase.
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{if(!configured())return null;const client=await authClient();const {data:{user},error}=await client.auth.getUser();if(error||!user?.email||!allowed(user.email))return null;const name=typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:user.email;return {userId:user.id,email:user.email,displayName:name,fullName:name};}
export async function requireChatGPTUser(_returnTo:string){const user=await getChatGPTUser();if(!user)redirect('/login');return user;}
