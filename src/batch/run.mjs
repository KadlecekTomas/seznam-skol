import * as cheerio from 'cheerio';
import { mkdir,readFile,writeFile,rename,open,unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PublicSession,safeUrl,hostKey } from './network.mjs';
import { extractContacts,dedupeContacts,fold,parseName } from './extract.mjs';
const FREE=new Set('gmail.com googlemail.com outlook.com hotmail.com live.com icloud.com me.com seznam.cz email.cz post.cz centrum.cz atlas.cz volny.cz tiscali.cz iol.cz quick.cz yahoo.com yahoo.cz aol.com cmail.cz razdva.cz t-email.cz'.split(' '));
const BAD=/\.(?:pdf|docx?|xlsx?|jpe?g|png|gif|zip|mp[34]|webp|svg)(?:$|[?#])/i;
export function priority(url,label='') {
 const s=fold(new URL(url).pathname+' '+label);let n=0;
 if(/kontakt|contacts/.test(s))n+=30;
 if(/pedagog|zamestnan|učitel|ucitel|sbor|nas-tym|nas tym|staff|our.team|teachers/.test(s))n+=45;
 if(/vedeni|management|pracovnici|lide/.test(s))n+=20;
 if(/o.skole|o.nas|about|profil/.test(s))n+=6;
 if(/archiv|aktualit|novink|galerie|jidelni|kalendar|soutez/.test(s))n-=35;
 return n;
}
export function candidates(school,hints=[]) {
 const urls=[...hints];for(const email of school.registryEmails){let domain=email.toLowerCase().split('@')[1];if(!domain||FREE.has(domain))continue;domain=domain.replace(/^(?:mail|smtp|posta)\./,'');urls.push('https://'+domain,'https://www.'+domain.replace(/^www\./,''));}
 return [...new Set(urls.map(u=>safeUrl(u)).filter(Boolean))].slice(0,5);
}
function relevantLinks(html,base) {
 const $=cheerio.load(html);const found=new Map();
 $('a[href]').each((_,a)=>{const label=$(a).text().trim(); const u=safeUrl($(a).attr('href'),base);if(!u||hostKey(new URL(u).hostname)!==hostKey(new URL(base).hostname)||BAD.test(u))return;
  const score=Math.max(priority(u,label),(priority(base)>=20&&parseName(label))?42:0);if(score>=5)found.set(u,{url:u,score,label});});return [...found.values()].sort((a,b)=>b.score-a.score);
}
export function identity(html,school){
 const $=cheerio.load(html);$('script,style,noscript,template').remove();const text=fold($.text());
 const mails=[];$('a[href^="mailto:" i]').each((_,e)=>mails.push(($(e).attr('href')??'').toLowerCase().slice(7).split('?')[0]));
 const matchedEmail=school.registryEmails.some(e=>text.includes(e.toLowerCase())||mails.includes(e.toLowerCase()));
 const ids=[school.ico,school.redIzo].filter(Boolean).filter(id=>new RegExp('(?:^|\\D)'+id+'(?:\\D|$)').test(text));
 const street=fold((school.addressStreet??'').replace(/\d.*$/u,'')).trim();const address=street.length>4&&text.includes(street);
 const words=fold(school.name).split(/[^a-z]+/).filter(w=>w.length>3&&!['skola','skoly','zakladni','stredni','praha','mesto','hlavniho','mesta','prispevkova','organizace','soukroma','odborna','vyssi','gymnazium','materska'].includes(w));
 const hits=[...new Set(words.filter(w=>text.includes(w)))];
 return {verified:(ids.length>0&&(matchedEmail||hits.length>0||address))||(matchedEmail&&(address||hits.length>=2)),signals:{ids,matchedEmail,address,nameTokens:hits}};
}
export async function scanSchool(school,options={}){
 const startedAt=new Date().toISOString();let session,homepage,website=null;const trials=[];const pages=[];const queue=[];const seen=new Set();const contacts=[],review=[],profiles=[],inventories=[];const warnings=new Set();
 for(const url of candidates(school,options.hints)){
  const key=hostKey(new URL(url).hostname);if(trials.some(t=>t.key===key&&['ROBOTS_DISALLOWED','EXTERNAL_REDIRECT_REVIEW'].includes(t.error)))continue;
  const client=new PublicSession(url,{maxMs:80000,maxRequests:36,signal:options.signal});
  try {const home=await client.request(url);if(home.status!==200||!/(?:html|xhtml)/i.test(home.contentType)){trials.push({url,key,status:home.status,error:'NO_HTML'});continue;}
   let matches=identity(home.text,school);const probe=[];
   if(!matches.verified&&options.authority&&options.authority.website&&options.authority.id===school.externalRegistryId&&hostKey(new URL(options.authority.website).hostname)===key&&matches.signals.nameTokens.length>0&&!/domain.{0,20}for sale|domena.{0,20}prodej|parked domain/i.test(home.text)){matches={...matches,verified:true,authoritySource:options.authority.sourceUrl};}
   if(!matches.verified){for(const c of relevantLinks(home.text,home.url).slice(0,3)){try{const p=await client.request(c.url);if(p.status===200&&/html/i.test(p.contentType)){probe.push(p); const combined=identity(home.text+'\n'+probe.map(p=>p.text).join('\n'),school);if(combined.verified){matches=combined;break;}}}catch(e){trials.push({url:c.url,error:e.message});}}}
   trials.push({url,key,identity:matches});if(!matches.verified)continue;
   session=client;homepage=home;website=home.url;queue.push({url:home.url,score:100,cached:home},...probe.map(p=>({url:p.url,score:80,cached:p})));break;
  }catch(e){trials.push({url,key,error:e.message});}
 }
 if(!website)return {school,startedAt,finishedAt:new Date().toISOString(),status:'WEBSITE_UNRESOLVED',website:null,trials,pages,contacts:[],review:[],profiles:[],inventories:[],warnings:['WEBSITE_NOT_VERIFIED'],allPublishedContactsConfirmed:false};
 let fetched=0;const maxPages=options.pageBudget??20;
 while(queue.length&&fetched<maxPages){
  queue.sort((a,b)=>b.score-a.score);const item=queue.shift();if(seen.has(item.url))continue;seen.add(item.url);
  if(options.signal?.aborted){warnings.add('INTERRUPTED');break;}
  try{const p=item.cached??await session.request(item.url);fetched++;seen.add(p.url);
    const meta={url:p.url,status:p.status,bytes:p.bytes,observedAt:new Date().toISOString(),score:item.score};pages.push(meta);
    if(p.status!==200||!/(?:html|xhtml)/i.test(p.contentType)){warnings.add('PAGE_FETCH_FAILED');continue;}
    const out=extractContacts(p.text,p.url);contacts.push(...out.contacts.map(c=>({...c,observedAt:meta.observedAt})));review.push(...out.review);
    if(out.profiles.length){profiles.push({sourceUrl:p.url,cards:out.profiles});warnings.add('BROWSER_PROFILE_REVIEW_REQUIRED');}
    if(priority(p.url,item.label)>=20||out.directoryNames.length>=3)inventories.push({sourceUrl:p.url,names:out.directoryNames,matchedNames:out.matchedNames});
    for(const l of relevantLinks(p.text,p.url)){if(!seen.has(l.url)&&!queue.some(q=>q.url===l.url))queue.push(l);}
    if(priority(p.url,item.label)>=20){const $=cheerio.load(p.text); const downloadable=[];$('a[href]').each((_,a)=>{const u=safeUrl($(a).attr('href'),p.url);if(u&&BAD.test(u)&&/kontakt|ucitel|pedagog|zamestnan/i.test(fold($(a).text()+' '+u)))downloadable.push(u);});if(downloadable.length){warnings.add('DOCUMENT_CONTACTS_REVIEW_REQUIRED');meta.documents=downloadable;}}
  }catch(e){pages.push({url:item.url,status:null,error:e.message});warnings.add(e.message);if(['BUDGET_EXHAUSTED','CANCELLED'].includes(e.message))break;}
 }
 // Consult one root sitemap for staff pages absent from menu, within remaining budget.
 if(!options.skipSitemap&&fetched<maxPages&&!warnings.has('BUDGET_EXHAUSTED')){
  try{const sm=await session.request(new URL('/sitemap.xml',website).href);if(sm.status===200&&/<urlset/i.test(sm.text)){const $=cheerio.load(sm.text,{xmlMode:true});const locs=$('url > loc').map((_,l)=>$(l).text()).get().map(u=>safeUrl(u,website)).filter(u=>u&&hostKey(new URL(u).hostname)===session.key&&!seen.has(u)&&priority(u)>=20).slice(0,Math.min(4,maxPages-fetched));
   for(const u of locs){try{const p=await session.request(u);seen.add(u);if(p.status!==200||!/html/i.test(p.contentType))continue;const out=extractContacts(p.text,p.url);const now=new Date().toISOString();pages.push({url:p.url,status:200,bytes:p.bytes,observedAt:now,via:'SITEMAP'});contacts.push(...out.contacts.map(c=>({...c,observedAt:now})));review.push(...out.review);inventories.push({sourceUrl:p.url,names:out.directoryNames,matchedNames:out.matchedNames});if(out.profiles.length){profiles.push({sourceUrl:p.url,cards:out.profiles});warnings.add('BROWSER_PROFILE_REVIEW_REQUIRED');}}catch(e){warnings.add(e.message);}}
  } else if(sm.status===200&&/<sitemapindex/i.test(sm.text))warnings.add('SITEMAP_INDEX_NOT_EXPANDED');}catch(e){warnings.add('SITEMAP_'+e.message);}
 }
 if(queue.length)warnings.add('UNVISITED_RELEVANT_LINKS');
 const unique=dedupeContacts(contacts);review.push(...unique.conflicts);
 const people=new Set(inventories.flatMap(i=>i.names));const matched=new Set(unique.contacts.map(c=>c.identity));const missing=[...people].filter(n=>!matched.has(n));if(missing.length)warnings.add('PUBLISHED_NAMES_WITHOUT_PAIRED_EMAIL');
 const results={school,startedAt,finishedAt:new Date().toISOString(),status:unique.contacts.length?'CONTACTS_FOUND_PARTIAL':'NO_PAIRED_CONTACTS',website,trials,pages,contacts:unique.contacts,review,profiles,inventories,publishedPeopleDetected:people.size,unpairedPublishedNames:missing,warnings:[...warnings],remainingLinks:queue.map(q=>q.url).slice(0,100),allPublishedContactsConfirmed:false,requests:session.requests};
 return results;
}
export async function atomicJson(path,data){const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(data));await rename(tmp,path);}
export async function main(){
 const opts=Object.fromEntries(process.argv.slice(2).filter(s=>s.startsWith('--')&&s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(2,i),s.slice(i+1)];}));
 const out=opts.out??'data/prague-2026-10-01/batch';await mkdir(out+'/schools',{recursive:true});
 const lock=out+'/run.lock';let fd;try{fd=await open(lock,'wx');await fd.writeFile(String(process.pid));}catch{throw new Error('RUN_LOCK_EXISTS: verify previous process before recovery');}
 const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
 const schools=JSON.parse(await readFile(opts.input??'data/prague-2026-10-01/schools.json','utf8'));const limit=Number(opts.limit??schools.length);const workers=Number(opts.workers??5);if(!Number.isInteger(workers)||workers<1||workers>8)throw new Error('INVALID_WORKERS');
 const hints=opts.hints?JSON.parse(await readFile(opts.hints,'utf8')):{};let next=0,completed=0,resumed=0;const keys=new Set(schools.map(s=>s.externalRegistryId));if(keys.size!==schools.length)throw new Error('DUPLICATE_SCHOOLS');
 const startedAt=new Date().toISOString();
 try{await Promise.all(Array.from({length:workers},async()=>{while(next<Math.min(limit,schools.length)&&!controller.signal.aborted){const s=schools[next++];const file=out+'/schools/'+s.externalRegistryId.replace(/[^\w-]/g,'_')+'.json';try{const existing=JSON.parse(await readFile(file,'utf8'));if(existing.school?.externalRegistryId===s.externalRegistryId&&existing.finishedAt){resumed++;completed++;continue;}}catch{}
 let result;try{result=await scanSchool(s,{pageBudget:Number(opts.pages??20),hints:hints[s.externalRegistryId]??[],signal:controller.signal});}catch(e){result={school:s,status:'FAILED',contacts:[],warnings:[e.message],finishedAt:new Date().toISOString()};}
 await atomicJson(file,result);completed++; console.log(JSON.stringify({completed,total:Math.min(limit,schools.length),id:s.externalRegistryId,name:s.name,status:result.status,contacts:result.contacts.length,pages:result.pages?.length??0,warnings:result.warnings}));}
 }));await atomicJson(out+'/run.json',{startedAt,finishedAt:new Date().toISOString(),expected:schools.length,requested:Math.min(limit,schools.length),completed,resumed,cancelled:controller.signal.aborted});}
 finally{await fd.close();await unlink(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1;});
