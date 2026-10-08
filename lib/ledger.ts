import type {Appearance} from './appearance';
export type Receipt={id:string;name:string};
export type Transaction={id:string;day:number;description:string;vendor:string;category:string;amount:number;method:'cash'|'transfer';source:'advance'|'personal';settled:null|'advance'|'office';settledAt?:string;note:string;receipts:Receipt[]};
export type AdvanceGroup={id:string;start:number;end:number;amount:number};
export type Trip={id:string;name:string;start:string;days:number;advances:number[];advanceGroups?:AdvanceGroup[];transactions:Transaction[]};
export type Audit={id:string;at:string;actor:string;tripId:string;trip:string;action:string;detail:string};
export type Ledger={trips:Trip[];audit:Audit[];appearance?:Appearance};
export const emptyLedger:Ledger={trips:[],audit:[]};
export const rupiah=(n:number)=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
export function summary(t:Trip,day?:number){
 const tx=t.transactions.filter(x=>day===undefined||x.day===day);
 const advance=day===undefined?budgetScopes(t).reduce((a,g)=>a+g.amount,0):budgetScopes(t).find(g=>g.start===day)?.amount||0;
 const expense=tx.reduce((a,x)=>a+x.amount,0);
 const direct=tx.filter(x=>x.source==='advance').reduce((a,x)=>a+x.amount,0);
 const reimbursed=tx.filter(x=>x.source==='personal'&&x.settled).reduce((a,x)=>a+x.amount,0);
 const fromAdvance=tx.filter(x=>x.source==='personal'&&x.settled==='advance').reduce((a,x)=>a+x.amount,0);
 const fromOffice=tx.filter(x=>x.source==='personal'&&x.settled==='office').reduce((a,x)=>a+x.amount,0);
 const pending=tx.filter(x=>x.source==='personal'&&!x.settled).reduce((a,x)=>a+x.amount,0);
 return {advance,expense,direct,reimbursed,fromAdvance,fromOffice,pending,balance:advance-direct-fromAdvance,after:advance-direct-fromAdvance-pending};
}
export function dayDate(t:Trip,day:number){const d=new Date(t.start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+day-1);return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}

export function groupFor(t:Trip,day:number){return t.advanceGroups?.find(g=>day>=g.start&&day<=g.end);}
export function budgetLabel(t:Trip,day:number){const g=groupFor(t,day);return g?`Day ${g.start}–${g.end}`:`Day ${day}`;}
export function budgetScopes(t:Trip){return Array.from({length:t.days},(_,i)=>i+1).flatMap(day=>{const g=groupFor(t,day);return g?(g.start===day?[g]:[]):[{id:'day-'+day,start:day,end:day,amount:t.advances[day-1]||0}];});}
export function budgetSummary(t:Trip,day:number){const g=groupFor(t,day);if(!g)return summary(t,day);const scoped={...t,transactions:t.transactions.filter(x=>x.day>=g.start&&x.day<=g.end)};const s=summary(scoped);return {...s,advance:g.amount,balance:g.amount-s.direct-s.fromAdvance,after:g.amount-s.direct-s.fromAdvance-s.pending};}
