import {redirect} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {configured} from '@/lib/auth';
import LoginForm from './form';
export const dynamic='force-dynamic';
export default async function Login(){if(await getChatGPTUser())redirect('/');return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#f4f6f2'}}><section style={{width:'100%',maxWidth:420,padding:32,borderRadius:24,background:'white',boxShadow:'0 16px 60px #16330010'}}><h1 style={{fontSize:40,color:'#163300',marginBottom:12}}>Saku</h1><p style={{marginBottom:24}}>Catatan keuangan perjalanan tim.</p>{configured()?<LoginForm/>:<p role="alert">Aplikasi belum selesai disiapkan. Isi daftar email anggota pada SAKU_ALLOWED_EMAILS, lalu buat akun lewat scripts/saku-user.mjs di server.</p>}</section></main>;}
