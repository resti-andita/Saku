import {admin} from './supabase';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export async function recordAccess(user:ChatGPTUser,action?:string){const {error}=await admin().rpc('record_saku_access',{p_user_id:user.userId,p_name:user.displayName,p_action:action||null});if(error)throw error;}
