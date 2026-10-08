import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function moduleFrom(path){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
let checks=0;
const is=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};

const security=await moduleFrom('lib/request-security.ts');
// Header `Host` termasuk forbidden header di Request, jadi dipakai stub tipis:
// sameOrigin hanya membaca headers.get().
const req=(headers)=>({headers:{get:(k)=>headers[k.toLowerCase()]??null}});
const proxy={host:'saku.example','x-forwarded-host':'saku.example','x-forwarded-proto':'https'};

// Kasus yang dulu SELALU gagal: req.url selalu berisi host internal Next
// (localhost:3000), sehingga permintaan sah dari server sendiri ditolak 403.
is(security.sameOrigin(req({origin:'http://127.0.0.1:4119',host:'127.0.0.1:4119'})),true,'port sendiri harus diterima');
is(security.sameOrigin(req({origin:'https://saku.example',host:'localhost:3000','x-forwarded-host':'saku.example','x-forwarded-proto':'https'})),true,'di belakang proxy');
is(security.sameOrigin(req({origin:'https://saku.example',...proxy})),true,'domain + https');
is(security.sameOrigin(req({origin:'https://evil.example',...proxy})),false,'origin lain ditolak');
is(security.sameOrigin(req({...proxy})),false,'tanpa Origin ditolak');
is(security.sameOrigin(req({origin:'https://saku.example',...proxy,'sec-fetch-site':'cross-site'})),false,'cross-site ditolak');

const receipt=await moduleFrom('lib/receipt-validation.ts');
is(receipt.validReceipt(new TextEncoder().encode('%PDF-1.7'),'application/pdf'),true);
is(receipt.validReceipt(new TextEncoder().encode('<script>alert(1)</script>'),'application/pdf'),false);
is(receipt.validReceipt(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true);
is(receipt.validReceipt(new Uint8Array([137,80]),'image/png'),false);
is(receipt.validReceipt(new TextEncoder().encode('xxxx0000WEBP'),'image/webp'),false);
is(receipt.validReceipt(new Uint8Array(receipt.MAX_RECEIPT_SIZE+1),'image/jpeg'),false);

const ledger=await moduleFrom('lib/ledger.ts');
const trip={id:'x',name:'Trip',start:'2026-10-08',days:2,advances:[0,0],advanceGroups:[{id:'g',start:1,end:2,amount:1000000}],transactions:[{id:'a',day:1,amount:200000,source:'advance',settled:null},{id:'b',day:2,amount:100000,source:'personal',settled:'advance'},{id:'c',day:2,amount:50000,source:'personal',settled:null}]};
is(ledger.summary(trip).balance,700000);
is(ledger.summary(trip).after,650000);
is(ledger.budgetSummary(trip,2).balance,700000);
is(ledger.budgetScopes(trip).length,1);

console.log(`${checks} checks passed: CSRF/same-origin, receipt signatures/size, grouped CA and reimburse balances.`);
