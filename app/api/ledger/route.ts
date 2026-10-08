import {sameOrigin} from '@/lib/request-security';
import {recordAccess} from '@/lib/team';
import {validateAppearance} from '@/lib/appearance';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import {readLedger,saveLedger,receiptById} from '@/lib/storage';
import { emptyLedger, groupFor, type Ledger, type Transaction } from '@/lib/ledger';
export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>Response.json({error},{status});
const read=readLedger;
export async function GET(){if(!await getChatGPTUser())return fail('Silakan masuk kembali.',401);try{const row=await read();return Response.json({data:row?JSON.parse(row.data):emptyLedger,version:row?.version??0},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return fail('Data belum bisa dimuat. Coba lagi.',503);}}
function money(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>100000000000)throw Error('Nominal rupiah tidak valid.');return v;}
function text(v:unknown,max=200){if(typeof v!=='string'||v.length>max)throw Error('Teks terlalu panjang atau tidak valid.');return v.trim();}
export async function POST(req:Request){const user=await getChatGPTUser();if(!user)return fail('Silakan masuk kembali.',401);if(!sameOrigin(req))return fail('Permintaan tidak diizinkan.',403);
try{if(Number(req.headers.get('content-length')||0)>100000)return fail('Permintaan terlalu besar.');const b:any=await req.json();const row=await read();if(b.version!==(row?.version??0))return fail('Data telah diubah anggota lain. Muat ulang data, lalu simpan kembali perubahan kamu.',409);
const data:Ledger=row?JSON.parse(row.data):structuredClone(emptyLedger);let trip=data.trips.find(t=>t.id===b.tripId);let detail='',action='';
if(b.action==='appearance'){data.appearance=validateAppearance(b.appearance);action='Tampilan diubah';detail='Font, warna, dan tulisan antarmuka diperbarui.';}
else if(b.action==='trip'){const name=text(b.name);if(!name)throw Error('Nama trip wajib diisi.');if(!Number.isInteger(b.days)||b.days<1||b.days>90)throw Error('Durasi harus 1–90 hari.');if(!/^\d{4}-\d{2}-\d{2}$/.test(b.start)||isNaN(Date.parse(b.start)))throw Error('Tanggal tidak valid.');trip={id:crypto.randomUUID(),name,start:b.start,days:b.days,advances:Array(b.days).fill(0),transactions:[]};data.trips.push(trip);action='Trip dibuat';detail=name;
}else{if(!trip)throw Error('Trip tidak ditemukan.');
if(b.action==='delete-trip'){if(typeof b.confirmName!=='string'||b.confirmName!==trip.name)throw Error('Nama konfirmasi harus sama persis dengan nama trip.');detail=`Trip ${trip.name} (${trip.days} hari, ${trip.transactions.length} transaksi) dihapus dari daftar aktif.`;data.trips=data.trips.filter(t=>t.id!==trip!.id);action='Trip dihapus';}
else if(b.action==='group-advance'){
if(!Number.isInteger(b.start)||!Number.isInteger(b.end)||b.start<1||b.end>trip.days||b.end<=b.start)throw Error('Pilih minimal dua hari dalam trip.');
if((trip.advanceGroups||[]).some(g=>b.start<=g.end&&b.end>=g.start))throw Error('Ada hari yang sudah tergabung. Pisahkan kelompok tersebut dahulu.');
const amount=money(b.amount);const before=trip.advances.slice(b.start-1,b.end);
trip.advanceGroups=[...(trip.advanceGroups||[]),{id:crypto.randomUUID(),start:b.start,end:b.end,amount}];
for(let d=b.start;d<=b.end;d++)trip.advances[d-1]=0;
action='Hari dan CA digabung';detail=`Day ${b.start}–${b.end}: CA harian sebelumnya ${before.join(', ')} diganti satu CA bersama Rp${amount}.`;
}
else if(b.action==='ungroup-advance'){
const g=trip.advanceGroups?.find(g=>g.id===b.groupId);if(!g)throw Error('Kelompok CA tidak ditemukan.');
trip.advanceGroups=trip.advanceGroups!.filter(x=>x.id!==g.id);trip.advances[g.start-1]=g.amount;
action='CA dipisahkan';detail=`Day ${g.start}–${g.end}: Rp${g.amount} ditempatkan di Day ${g.start}; hari lainnya Rp0. Transaksi tetap pada hari asal.`;
}
else if(b.action==='advance'){if(!Number.isInteger(b.day)||b.day<1||b.day>trip.days)throw Error('Hari tidak valid.');const value=money(b.amount);const g=groupFor(trip,b.day);detail=g?`Day ${g.start}–${g.end}: ${g.amount} → ${value}`:`Day ${b.day}: ${trip.advances[b.day-1]} → ${value}`;if(g)g.amount=value;else trip.advances[b.day-1]=value;action='Cash advance diubah';}
else if(b.action==='transaction'){const v=b.transaction;if(!Number.isInteger(v.day)||v.day<1||v.day>trip.days)throw Error('Hari tidak valid.');if(!['cash','transfer'].includes(v.method)||!['advance','personal'].includes(v.source))throw Error('Sumber atau metode tidak valid.');if(v.method==='transfer'&&v.source!=='personal')throw Error('Transfer harus menggunakan uang pribadi.');const old=trip.transactions.find(x=>x.id===v.id);if(v.id&&!old)throw Error('Transaksi tidak ditemukan.');if(old?.settled)throw Error('Batalkan pelunasan terlebih dahulu sebelum mengedit transaksi.');const amount=money(v.amount);if(!amount)throw Error('Nominal harus lebih dari nol.');const description=text(v.description);if(!description)throw Error('Keperluan wajib diisi.');if(!Array.isArray(v.receipts)||v.receipts.length>8)throw Error('Maksimal 8 struk.');const receipts=[];for(const r of v.receipts){const found=await receiptById(text(r.id));if(!found)throw Error('Struk tidak ditemukan.');receipts.push({id:found.id,name:found.name});}
const tx:Transaction={id:old?.id||crypto.randomUUID(),day:v.day,description,vendor:text(v.vendor),category:text(v.category),amount,method:v.method,source:v.source,settled:null,note:text(v.note,2000),receipts:receipts as any};if(old)trip.transactions[trip.transactions.indexOf(old)]=tx;else trip.transactions.push(tx);action=old?'Transaksi diubah':'Transaksi ditambahkan';detail=JSON.stringify({before:old??null,after:tx});}
else if(b.action==='settle'){const tx=trip.transactions.find(x=>x.id===b.id);if(!tx||tx.source!=='personal')throw Error('Transaksi reimburse tidak ditemukan.');if(![null,'advance','office'].includes(b.source))throw Error('Sumber pelunasan tidak valid.');if(b.source&&tx.settled)throw Error('Sudah dilunasi.');detail=`Day ${tx.day} · ${tx.description} · Rp${tx.amount} · ${tx.settled||'belum dibayar'} → ${b.source||'belum dibayar'}`;tx.settled=b.source;tx.settledAt=b.source?new Date().toISOString():undefined;action=b.source?'Reimburse dilunasi':'Pelunasan dibatalkan';}
else if(b.action==='delete'){const tx=trip.transactions.find(x=>x.id===b.id);if(!tx)throw Error('Transaksi tidak ditemukan.');if(tx.settled)throw Error('Batalkan pelunasan sebelum menghapus transaksi.');detail=JSON.stringify(tx);trip.transactions=trip.transactions.filter(x=>x.id!==b.id);action='Transaksi dihapus';}else throw Error('Tindakan tidak valid.');}
data.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),actor:user.displayName,tripId:b.action==='appearance'?'settings':trip!.id,trip:b.action==='appearance'?'Pengaturan tampilan':trip!.name,action,detail});const json=JSON.stringify(data);if(new TextEncoder().encode(json).length>3500000)throw Error('Kapasitas laporan tercapai. Hubungi pengelola.');
const changed=await saveLedger(json,row?.version??null);if(!changed)return fail('Data baru saja berubah. Muat ulang sebelum menyimpan.',409);try{await recordAccess(user,action)}catch(e){console.error('Activity recording failed',e)}return Response.json({data,version:(row?.version??0)+1});
}catch(e){console.error(e);return fail(e instanceof Error?e.message:'Gagal menyimpan. Coba lagi.');}}
