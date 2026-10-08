import {requireChatGPTUser} from './chatgpt-auth';
import LedgerApp from './ledger-app';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireChatGPTUser('/');return <LedgerApp user={user.displayName}/>;}
