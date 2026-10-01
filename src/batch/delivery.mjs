/** Compact lossless transfer encoding for the seven business columns plus audit URLs.
 * Email pattern flags encode an already-observed exact address; no candidate email is generated.
 */
import fs from 'node:fs';import {brotliCompressSync,constants}from'node:zlib';import {createHash}from'node:crypto';
const root=process.argv[2]||'exports/prague-full-20261001';const r=JSON.parse(fs.readFileSync(root+'/result.json'));
const firsts=[],domains=[],sources=[];const dict=(a,s)=>{let i=a.indexOf(s);if(i<0){i=a.length;a.push(s);}return i;};
const fold=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z]/g,'');
function codeEmail(first,last,email){const [local,domain]=email.split('@');const f=fold(first),l=fold(last);const opts=[l,f+'.'+l,f[0]+l,f[0]+'.'+l,l+'.'+f,f+l,l+f[0]];const i=opts.indexOf(local);return [i<0?local:i,dict(domains,domain)];}
const schoolRows=r.schools.map(s=>[s.school.externalRegistryId,s.school.name,s.school.addressFull,s.website,s.school.schoolType,s.status,s.contacts,s.pages||0,s.browserPages||0,s.profileCards||0,s.openedCards||0,s.remainingPages||0,s.browserTargets||0,(s.notes||[]).length,(s.errors||[]).length,[...new Set((s.errors||[]).map(e=>e.code))].join('; '),s.school.registrySourceUrl]);
const ids=new Map(schoolRows.map((s,i)=>[s[0],i]));
const contactRows=r.contacts.map(c=>[ids.get(c.schoolId),dict(firsts,c.firstName),c.lastName,...codeEmail(c.firstName,c.lastName,c.email),dict(sources,c.sourceUrl),['STATIC_MAILTO','STATIC_TEXT','BROWSER_VISIBLE_DOM','BROWSER_PROFILE_CARD'].indexOf(c.method)]);
const payload={version:1,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague'}).format(new Date()),firsts,domains,sources,schools:schoolRows,contacts:contactRows,summary:r.summary};const json=JSON.stringify(payload);const b=brotliCompressSync(Buffer.from(json),{params:{[constants.BROTLI_PARAM_QUALITY]:11}});fs.writeFileSync(root+'/delivery.json.br',b);fs.writeFileSync(root+'/delivery.b64',b.toString('base64'));console.log(JSON.stringify({contacts:contactRows.length,schools:schoolRows.length,compressedBytes:b.length,base64Chars:b.toString('base64').length,sha256:createHash('sha256').update(b).digest('hex')}));
