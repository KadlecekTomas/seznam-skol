import {readFile,mkdir}from'node:fs/promises';
import {scanSchool,atomicJson}from'./run.mjs';
const hints={
 '691017999':['https://zsakadem.cz/','https://zsakadem.cz/kontakt'],
 '600040411':['https://www.zsspojencu.cz/','https://www.zsspojencu.cz/kontakty'],
 '691020531':['https://skolamalehoprince.cz/','https://skolamalehoprince.cz/kontakt/'],
 '691020680':['https://www.mirador.school/'],
 '691020124':['https://www.sraz.org/sps','https://www.sraz.org/kontakt'],
 '691018111':['https://www.fostraelementary.cz/kontakt'],
 '691019347':['https://www.fostraelementary.cz/kontakt'],
 '691017417':['https://skoladetibudoucnosti.cz/'],
 '691018707':['https://sgymseberov.cz/']
};
const root='data/prague-2026-10-01';const schools=JSON.parse(await readFile(root+'/schools.json','utf8'));await mkdir(root+'/manual-recovery',{recursive:true});
let next=0;const work=Object.entries(hints);
await Promise.all(Array.from({length:3},async()=>{while(next<work.length){const [id,urls]=work[next++];const school=schools.find(s=>s.externalRegistryId===id);if(!school)throw new Error('Unknown registry identity');const r=await scanSchool(school,{hints:urls,pageBudget:20});r.discoveryEvidenceUrls=urls;await atomicJson(root+'/manual-recovery/'+id+'.json',r);console.log(JSON.stringify({id,status:r.status,contacts:r.contacts.length}));}}));
