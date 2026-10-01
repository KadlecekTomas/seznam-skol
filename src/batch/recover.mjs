import {readFile,readdir,mkdir}from'node:fs/promises';
import {scanSchool,atomicJson}from'./run.mjs';
const root='data/prague-2026-10-01';await mkdir(root+'/recovery',{recursive:true});const entries=[];
for(const f of await readdir(root+'/full/schools')){const r=JSON.parse(await readFile(root+'/full/schools/'+f,'utf8'));if(['WEBSITE_UNRESOLVED','NO_PAIRED_CONTACTS'].includes(r.status))entries.push(r);}
let index=0,done=0;
await Promise.all(Array.from({length:4},async()=>{while(index<entries.length){const original=entries[index++];const s=original.school;const file=root+'/recovery/'+s.externalRegistryId+'.json';try{await readFile(file);continue;}catch{}
 let ref=null;try{ref=JSON.parse(await readFile(root+'/ares/'+s.externalRegistryId+'.json','utf8'));}catch{}
 if(original.status==='WEBSITE_UNRESOLVED'&&!ref?.website){await atomicJson(file,{school:s,status:'NO_AUTHORITY_WEBSITE',contacts:[],warnings:['NO_AUTHORITY_WEBSITE'],finishedAt:new Date().toISOString()});continue;}
 const r=await scanSchool(s,{hints:[original.website,ref?.website].filter(Boolean),authority:ref,pageBudget:24});await atomicJson(file,r);done++;console.log(JSON.stringify({done,requested:entries.length,id:s.externalRegistryId,status:r.status,contacts:r.contacts.length}));}
}));console.log(JSON.stringify({finished:true,done}));
