/** Assemble private public-source observations. Never claim complete coverage from contact count. */
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseName,fold,dedupeContacts } from './extract.mjs';
import { validEmail,GENERIC_MAILBOXES } from '../pilot/evidence.mjs';
import { hostKey,safeUrl } from './network.mjs';
const root='data/prague-2026-10-01';
const host=u=>{try{return hostKey(new URL(u).hostname);}catch{return '';}};
export function exclusionReason(c){
 if(!validEmail(c.email)||/^(?:jmeno[._-]prijmeni|prijmeni[._-]jmeno|example|test|yourname|username)@/i.test(c.email))return 'INVALID_OR_PLACEHOLDER_EMAIL';
 if(GENERIC_MAILBOXES.has(c.email.split('@')[0]))return 'ORGANISATION_MAILBOX';
 const text=fold(c.evidenceText??'');
 if(/(?:za rodice|za zaky|za studenty|zastupc[ei] rodicu|zastupkyne rodicu|zastupce zaku|zastupce studentu)/u.test(text))return 'PARENT_OR_STUDENT_REPRESENTATIVE';
 if(/^(?:student|studentka|zak|zakyne)(?:\s|$)/u.test(fold(c.role??'')))return 'NOT_STAFF_ROLE';
 return null;
}
const csCell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/u.test(s))s="'"+s;return /[;"\r\n]/u.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
const csv=rows=>'\uFEFF'+rows.map(r=>r.map(csCell).join(';')).join('\r\n')+'\r\n';
async function readStage(path){const out=[];try{for(const f of await readdir(path)){if(f.endsWith('.json'))out.push(JSON.parse(await readFile(path+'/'+f,'utf8')));}}catch{}return out;}
export async function assemble(){
 const schools=JSON.parse(await readFile(root+'/schools.json','utf8'));const results=new Map(schools.map(s=>[s.externalRegistryId,{school:s,runs:[],browser:[],raw:[],review:[]}])) ;
 for(const stage of ['full/schools','recovery','manual-recovery'])for(const r of await readStage(root+'/'+stage)){const target=results.get(r.school?.externalRegistryId);if(!target)continue;target.runs.push(r);target.raw.push(...(r.contacts??[]));target.review.push(...(r.review??[]));}
 const authority=new Map((await readStage(root+'/ares')).map(a=>[a.id,a]));
 const rejected=[];
 for(const r of await readStage(root+'/browser')){const target=results.get(r.id);if(!target)continue;
   const verifiedHosts=new Set(target.runs.filter(x=>x.website).map(x=>host(x.website)));const schoolEmailHosts=target.school.registryEmails.map(x=>x.split('@')[1]);
   for(const c of r.contacts??[]){if(!verifiedHosts.has(host(c.sourceUrl))){rejected.push({schoolId:r.id,name:c.publishedName,email:c.email,sourceUrl:c.sourceUrl,reason:'BROWSER_SCHOOL_HOST_MISMATCH'});continue;}target.raw.push(c);}
   target.browser.push(r);target.review.push(...(r.review??[]));
 }
 let prior=[];try{prior=JSON.parse(await readFile(root+'/previous-ledger-rows.json','utf8'));}catch{}
 const oldDates=new Map(prior.map(([first,last,email,web,date])=>[fold(first+' '+last)+'|'+email.toLowerCase()+'|'+host(web),date]));
 const all=[];
 for(const [id,r]of results){const good=[];for(const c of r.raw){const n=parseName(c.publishedName??(c.firstName+' '+c.lastName));const reason=exclusionReason(c)||(!n?'NAME_SPLIT_REVIEW':null);if(reason){rejected.push({schoolId:id,name:c.publishedName,email:c.email,sourceUrl:c.sourceUrl,reason});continue;}
   good.push({...c,...n,identity:n.identity,schoolId:id});}
  const d=dedupeContacts(good);for(const c of d.conflicts)rejected.push({schoolId:id,name:c.identities?.join(' / '),email:c.email,reason:c.reason});r.cleaned=d.contacts;all.push(...d.contacts);
 }
 // A network-wide contact on a shared site must not silently become a person at every legal school.
 const byMail=new Map();for(const c of all){const key=c.email+'|'+host(c.sourceUrl);const a=byMail.get(key)??[];a.push(c);byMail.set(key,a);}
 const shared=new Set();for(const [key,a] of byMail)if(new Set(a.map(c=>c.schoolId)).size>1)shared.add(key);
 const contacts=[];
 for(const c of all){if(shared.has(c.email+'|'+host(c.sourceUrl))){rejected.push({schoolId:c.schoolId,name:c.publishedName,email:c.email,sourceUrl:c.sourceUrl,reason:'SHARED_SITE_MULTIPLE_SCHOOL_IDENTITIES'});continue;}
   const collectedAt=oldDates.get(c.identity+'|'+c.email+'|'+host(c.sourceUrl))??'2026-10-01';
   contacts.push({...c,collectedAt,lastObservedAt:(c.observedAt??'2026-10-01').slice(0,10),validation:'AUTOMATED_PUBLIC_SOURCE_ASSOCIATION',deliveryVerified:false,marketingPermission:'NOT_ASSESSED'});
 }
 contacts.sort((a,b)=>results.get(a.schoolId).school.name.localeCompare(results.get(b.schoolId).school.name,'cs')||a.lastName.localeCompare(b.lastName,'cs')||a.firstName.localeCompare(b.firstName,'cs')||a.email.localeCompare(b.email));
 const schoolRows=[];for(const [id,r]of results){const successful=r.runs.filter(x=>x.website);const best=successful.at(-1)??r.runs.at(-1);const pages=[...new Set(r.runs.flatMap(x=>(x.pages??[]).filter(p=>p.status===200).map(p=>p.url)))];const local=contacts.filter(c=>c.schoolId===id);
   const allWarnings=new Set(r.runs.flatMap(x=>x.warnings??[]));const issues=r.review.length;
   const bestProfiles=new Map();for(const b of r.browser)for(const p of b.pages??[]){if(p.coverage?.expectedCards>0)bestProfiles.set(p.url,p.coverage);}
   const profileExpected=[...bestProfiles.values()].reduce((n,p)=>n+p.expectedCards,0),profileOpened=[...bestProfiles.values()].reduce((n,p)=>n+p.openedCards,0);
   const unmatched=[...new Set(r.runs.flatMap(x=>x.unpairedPublishedNames??[]))].filter(n=>!local.some(c=>c.identity===n));
   if(profileExpected>0&&profileExpected===profileOpened)allWarnings.delete('BROWSER_PROFILE_REVIEW_REQUIRED');
   const matrixStatus=local.length?'CONTACTS_FOUND_COVERAGE_UNCONFIRMED':best?.website?'WEBSITE_CHECKED_NO_ACCEPTED_CONTACTS':'WEBSITE_NOT_RESOLVED';
   const org=authority.get(id);schoolRows.push({id,name:r.school.name,type:r.school.schoolType,address:r.school.addressFull,website:best?.website??'',registryWebsite:org?.website??'',registryWebsiteSource:org?.sourceUrl??'',registrySource:r.school.registrySourceUrl,contacts:local.length,pages:pages.length,status:matrixStatus,profileExpected,profileOpened,unmatchedNames:unmatched.length,reviewCandidates:issues,warnings:[...allWarnings],allPublishedContactsConfirmed:false});
 }
 schoolRows.sort((a,b)=>a.name.localeCompare(b.name,'cs'));
 const rejectedUnique=[...new Map(rejected.map(r=>[[r.schoolId,r.email,r.name,r.reason].join('|'),r])).values()];
 const priorNotObserved=prior.filter(([first,last,email,web])=>!contacts.some(c=>c.identity===fold(first+' '+last)&&c.email===email.toLowerCase()&&host(c.sourceUrl)===host(web))).map(([first,last,email,web,date])=>({first,last,email,web,collectedAt:date,status:'PREVIOUS_PILOT_NOT_RECONFIRMED_IN_THIS_RUN'}));
 const summary={schemaVersion:1,collectionDate:'2026-10-01',assembledAt:new Date().toISOString(),schoolsInRegistry:schools.length,schoolsAttempted:[...results.values()].filter(r=>r.runs.length>0).length,schoolsWithContacts:schoolRows.filter(s=>s.contacts>0).length,schoolsWithoutAcceptedContacts:schoolRows.filter(s=>s.contacts===0&&s.website).length,websitesUnresolved:schoolRows.filter(s=>!s.website).length,contacts:contacts.length,uniqueEmails:new Set(contacts.map(c=>c.email)).size,uniquePersonSchoolAssociations:new Set(contacts.map(c=>c.schoolId+'|'+c.identity)).size,sourcePages:new Set(contacts.map(c=>c.sourceUrl)).size,quarantinedContactCandidates:rejectedUnique.length,priorContactsRetained:contacts.filter(c=>c.collectedAt==='2026-09-30').length,priorContactsNotReconfirmed:priorNotObserved.length,browserSchools:schoolRows.filter(s=>s.profileExpected>0).length,fullyInventoriedSchoolCount:0,allPublishedContactsConfirmed:false,notes:['All 509 registry organisations received a first scan attempt.','Accepted means an explicit public-source name/email association, not delivery or permission to market.','School employee completeness is not certified. Some sites expose only email patterns, PDFs or unsupported interactive layouts.','Private raw source observations remain in data/prague-2026-10-01, never committed.']};
 await mkdir(root+'/assembled',{recursive:true});
 for(const [file,value]of [['summary.json',summary],['contacts.json',contacts],['schools.json',schoolRows],['quarantine.json',rejectedUnique],['previous-not-reconfirmed.json',priorNotObserved]])await writeFile(root+'/assembled/'+file,JSON.stringify(value));
 const schoolMap=new Map(schoolRows.map(s=>[s.id,s]));
 await writeFile(root+'/assembled/kontakty.csv',csv([['Jméno','Příjmení','E-mail','Škola','Adresa školy','Web','Datum sebrání'],...contacts.map(c=>{const s=schoolMap.get(c.schoolId);return[c.firstName,c.lastName,c.email,s.name,s.address,s.website,c.collectedAt];})]));
 await writeFile(root+'/assembled/overeni.csv',csv([['RED IZO','Jméno','Příjmení','E-mail','Zdroj kontaktu','Publikované jméno','Publikovaný e-mail','Funkce','Metoda','První sběr','Poslední kontrola','Doručitelnost ověřena','Oprávnění k marketingu'],...contacts.map(c=>[c.schoolId,c.firstName,c.lastName,c.email,c.sourceUrl,c.publishedName,c.publishedEmail,c.role,c.method,c.collectedAt,c.lastObservedAt,'NE','NEPOSOUZENO'])]));
 // Compact, lossless transport format uses indices for repeated schools, sources and methods.
 const strings=[];const dictionary=new Map();const idx=s=>{s=String(s??'');if(!dictionary.has(s)){dictionary.set(s,strings.length);strings.push(s);}return dictionary.get(s);};
 const smallContacts=contacts.map(c=>[c.firstName,c.lastName,c.email,idx(c.schoolId),idx(c.sourceUrl),idx(c.role),idx(c.method),c.collectedAt,c.lastObservedAt,c.publishedName,c.publishedEmail]);
 const payload={summary,schools:schoolRows,dictionary:strings,contacts:smallContacts,quarantine:rejectedUnique,previousNotObserved:priorNotObserved};
 await writeFile(root+'/assembled/delivery.json',JSON.stringify(payload));
 console.log(JSON.stringify(summary,null,2));return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)assemble();
