/** Official ARES school-registry API. Store only school website metadata, never personal addresses. */
import { readFile,mkdir } from 'node:fs/promises';
import { atomicJson } from './run.mjs';
import { safeUrl,sleep,UA } from './network.mjs';
const base='data/prague-2026-10-01';await mkdir(base+'/ares',{recursive:true});
const schools=JSON.parse(await readFile(base+'/schools.json','utf8'));let done=0,websites=0;
for(const s of schools){const file=base+'/ares/'+s.externalRegistryId+'.json';
 try{const old=JSON.parse(await readFile(file,'utf8'));done++;if(old.website)websites++;continue;}catch{}
 const sourceUrl='https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-rs/'+encodeURIComponent(s.ico);
 let row={id:s.externalRegistryId,ico:s.ico,sourceUrl,observedAt:new Date().toISOString(),website:null,status:'UNRESOLVED'};
 try{let r=await fetch(sourceUrl,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json','user-agent':UA}});
 if(r.status===429){await sleep(Math.min(30000,Number(r.headers.get('retry-after')??'15')*1000));r=await fetch(sourceUrl,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json','user-agent':UA}});}
 if(r.ok){const obj=await r.json();const rec=(obj.zaznamy??[]).find(x=>x.ico===s.ico&&x.redizo===s.redIzo&&!x.datumZaniku);if(rec){const raw=rec.kontakty?.www; const website=raw?safeUrl(/^https?:/i.test(raw)?raw:'https://'+raw):null;row={...row,website,registryUpdatedAt:rec.datumAktualizace,registryName:rec.obchodniJmeno,status:website?'OFFICIAL_WEBSITE_REFERENCE':'NO_WEBSITE_IN_RECORD'};}else row.status='IDENTITY_NOT_MATCHED';}else row.status='HTTP_'+r.status;
 }catch(e){row.status=e.message;}
 await atomicJson(file,row);done++;if(row.website)websites++;if(done%25===0)console.log(JSON.stringify({processed:done,total:schools.length,websites}));await sleep(500);
}
console.log(JSON.stringify({finished:true,processed:done,websites}));
