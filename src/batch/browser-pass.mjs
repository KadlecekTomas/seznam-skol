import { readFile,writeFile,readdir,mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { collectPublicProfileCards,profileCoverage } from '../pilot/browser-profiles.mjs';
import { extractContacts,parseName,fold,dedupeContacts } from './extract.mjs';
import { PublicSession,sleep,hostKey } from './network.mjs';
import { atomicJson } from './run.mjs';
import { isAllowedByRobots } from '../crawler/robots.ts';
const exec=promisify(execFile);const dir='data/prague-2026-10-01';await mkdir(dir+'/browser',{recursive:true});
const maximum=Number(process.argv[2]??40);const browserArgs=['--yes','agent-browser@0.38.1','--session','prague-completeness','--json'];
async function command(args){const r=await exec('npx',[...browserArgs,...args],{timeout:40000,maxBuffer:15000000});const lines=r.stdout.trim().split('\n');const data=JSON.parse(lines.at(-1));if(!data.success)throw new Error(data.error??'BROWSER_FAILED');return data.data;}
const schools=JSON.parse(await readFile(dir+'/schools.json','utf8'));const ch=schools.find(s=>s.externalRegistryId==='600040429'&&s.ico==='49625195');const input=[];
if(ch)input.push({school:ch,website:'https://www.fzschodovicka.cz',contacts:[],profiles:[{sourceUrl:'https://www.fzschodovicka.cz/skola/pedagogicky-sbor'}],pages:[{url:'https://www.fzschodovicka.cz/kontakty',status:200,score:30}]});
for(const f of await readdir(dir+'/full/schools')){let r=JSON.parse(await readFile(dir+'/full/schools/'+f,'utf8'));try{const recovery=JSON.parse(await readFile(dir+'/recovery/'+f,'utf8'));if(recovery.website)r=recovery;}catch{} if(!r.website||r.school.externalRegistryId===ch?.externalRegistryId)continue;if(r.profiles?.length||r.contacts.length<3)input.push(r);}
let processed=0,extra=0;
for(const r of input){if(processed>=maximum)break;const file=dir+'/browser/'+r.school.externalRegistryId+'.json';try{JSON.parse(await readFile(file,'utf8'));continue;}catch{}
 const urls=[...new Set([...(r.profiles??[]).map(p=>p.sourceUrl),...(r.pages??[]).filter(p=>p.status===200).sort((a,b)=>(b.score??0)-(a.score??0)).map(p=>p.url)])].slice(0,3);
 const result={id:r.school.externalRegistryId,school:r.school.name,contacts:[],review:[],pages:[],complete:false,observedAt:new Date().toISOString()};
 for(const url of urls){try{if(hostKey(new URL(url).hostname)!==hostKey(new URL(r.website).hostname))throw new Error('SCHOOL_HOST_BINDING_MISMATCH');
  const client=new PublicSession(url,{maxRequests:4,maxMs:15000});const pol=await client.policy(new URL(url).origin);
  if(pol.kind==='UNAVAILABLE'||!isAllowedByRobots(pol.text,url,'seznam-skol')){result.pages.push({url,error:'ROBOTS_REVIEW_REQUIRED'});continue;}
  const opened=await command(['open',url]);if(hostKey(new URL(opened.url).hostname)!==hostKey(new URL(url).hostname)){result.pages.push({url,error:'EXTERNAL_REDIRECT_REVIEW'});continue;}
  await sleep(900); await command(['eval','(()=>{let n=0;for(const d of document.querySelectorAll("main details,article details")){if(n++>=100)break;d.open=true;}return n;})()']);
  const x=await command(['eval','({html:document.documentElement.outerHTML,url:location.href})']);const html=x.result.html;const out=extractContacts(html,x.result.url);const now=new Date().toISOString();
  result.contacts.push(...out.contacts.map(c=>({...c,observedAt:now,method:'RENDERED_DOM_SINGLE_PERSON_SINGLE_MAILBOX'})));result.review.push(...out.review);
  const inventory=await command(['eval','('+collectPublicProfileCards.toString()+')({maxCards:200})']);const cap=inventory.result;const coverage=profileCoverage(cap);result.pages.push({url,coverage});
  for(const o of cap.observations){if(o.status!=='OPENED')continue;const n=parseName(o.publishedName);if(!n||o.publishedEmails.length!==1){result.review.push({name:o.publishedName,reason:!n?'NAME_REVIEW':o.publishedEmails.length?'MULTIPLE_MAILBOXES':'NO_PUBLISHED_EMAIL',sourceUrl:url});continue;}
   result.contacts.push({...n,email:o.publishedEmails[0].toLowerCase(),publishedEmail:o.publishedEmails[0],role:o.text.split('\n').find(x=>/učitel|asistent|ředitel|pedagog|vychovatel/i.test(x))??'',sourceUrl:url,evidenceText:o.text.slice(0,1200),observedAt:o.observedAt,method:'PUBLIC_PROFILE_OPENED',sourceKind:'BROWSER_PROFILE'});
  }
 }catch(e){result.pages.push({url,error:String(e.message).slice(0,300)});}}
 const d=dedupeContacts(result.contacts);result.contacts=d.contacts;result.review.push(...d.conflicts);result.finishedAt=new Date().toISOString();await atomicJson(file,result);processed++;extra+=result.contacts.length;console.log(JSON.stringify({processed,id:result.id,contacts:result.contacts.length,pages:result.pages.length}));
}
await command(['close']).catch(()=>{});console.log(JSON.stringify({finished:true,processed,contacts:extra}));
