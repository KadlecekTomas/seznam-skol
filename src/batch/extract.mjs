import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { normalizePublishedEmail, validEmail, GENERIC_MAILBOXES } from '../pilot/evidence.mjs';
export const fold = s => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const given = new Set(fold(`Adam Adriana Adéla Adina Agáta Alena Albert Alex Alexandra Alexandr Alice Alois Alžběta Amálie Andrea Anežka Aneta Angela Anna Antonie Antonín Arnošt Barbora Beáta Bedřich Běla Blanka Bohdan Bohumil Bohumila Bohuslav Bohuslava Boris Bořivoj Božena Bronislav Dagmar Dalibor Dana Daniel Daniela Dan Danica Darina David Denisa Denis Diana Dita Dominik Dominika Dora Dušan Edita Eduard Eliška Ella Elena Eleonora Emanuel Emil Emílie Erik Erika Ester Eva Evžen Evženie Felix Filip František Františka Gabriela Hana Hanka Helena Hedvika Hynek Igor Ilja Ilona Imrich Inna Irena Iva Ivan Ivana Iveta Ivona Ivo Jakub Jan Jana Jaromír Jaromíra Jaroslav Jaroslava Jarmila Jindřich Jindra Jiří Jiřina Jitka Jolana Josef Josefa Josefína Judita Julie Juraj Kamil Kamila Karel Karla Karolína Kateřina Klaudie Klára Kristina Kristýna Kryštof Květoslav Květoslava Ladislav Ladislava Laura Lenka Leopold Libor Libuše Lída Lidia Liliana Linda Livia Lubomír Lubomíra Luboš Lucie Luděk Ludmila Ludvík Lukáš Magdaléna Magdalena Magda Marcela Marcel Marek Marián Marian Margita Mariana Marianna Marie Marika Markéta Marta Martin Martina Matěj Matouš Maxmilián Michal Michaela Michaela Milan Milana Milena Miloslav Miloslava Miluše Miriam Miroslav Miroslava Monika Naďa Naděžda Nataliia Natálie Natalie Natalia Natasha Nela Nina Nikola Nikol Ondřej Oksana Olga Ota Otakar Otmar Otto Patrik Patricie Pavel Pavla Pavlína Petr Petra Radek Radim Radka Radana Radomír Radoslav Renata René Richard Robert Robin Romana Roman Růžena Rudolf Sabina Samuel Sandra Sára Saša Simona Simon Silvia Silvie Soňa Slavomír Slavomíra Stanislav Stanislava Světlana Šárka Šimon Štěpán Štěpánka Tadeáš Tamara Taťána Tereza Terezie Tomáš Tímea Věra Vendula Veronika Viktor Viktorie Vilém Vincent Vladimír Vladimíra Vladislav Vladislava Vlasta Vlastimil Vlastimila Vojtěch Vratislav Zbyněk Zdena Zdeněk Zdeňka Zina Zita Zlata Zuzana Žaneta Zoe Tim Timothy Thomas John James Michael David Peter Paul William George Mary Susan Sarah Elizabeth Andrew Robert Daniel Martin Maria Kevin Jonathan Daniel Daniel Steven Stephen Christopher Christine Jennifer Carol Anne Helen Juan Pierre Jean Luis Kate Jack Sofia Sophie Andrea Laura Barbara Hannah Janina Katarína Mária Ľubomír Róbert Ľudmila Nataliya Tetiana Kateryna Oleksandr Olena Yana Yuliia Iryna Halina Dorota Viola Vanessa Daria Vasil Petra`).split(' '));
const title = /^(?:(?:Mgr|MgA|BcA?|Ing|PhDr|RNDr|JUDr|PaedDr|ThDr|MUDr|MVDr|PharmDr|doc|prof|DiS|Dis|M\.A|MSc|MBA)\.?(?:\s+|$))+/iu;
const suffix = /,?\s+(?:Ph\.?D\.?|CSc\.?|DrSc\.?|MBA|MSc|LLM|DiS\.?)(?:\s.*)?$/iu;
const noise=/\b(?:skola|skoly|gymnazium|zakladni|stredni|praha|google|classroom|online|online|kontakt|kontakty|informace|reditele|reditel|reditelka|ucitel|ucitelka|zastupce|zastupkyne|predmet|tel|email|materska|cestina|anglictina|anglicky|jazyk|matematika|cesky|odborna|odborne|vedouci|sekretariat|skolni|tridni|studijni|vice|zobrazit|kancelar|kancelare|uredni|technicka|podpora|zamestnanci|sbor|ekonomka|sprava|specialni|socialni)\b/;
export function parseName(value) {
  let s=value.replace(/\u00a0/g,' ').trim().replace(title,'').replace(suffix,'').replace(/\s+/g,' ').trim();
  if(!s || s.length>90 || /[@0-9<>:/()\[\]|=]/u.test(s) || noise.test(fold(s))) return null;
  const words=s.split(' '); if(words.length<2||words.length>5||words.some(x=>!/^\p{Lu}[\p{L}\p{M}'’–-]+$/u.test(x)))return null;
  let firstName,lastName;
  if(given.has(fold(words[0]))) { let cut=1;while(cut<words.length-1&&given.has(fold(words[cut])))cut++; firstName=words.slice(0,cut).join(' ');lastName=words.slice(cut).join(' '); }
  else if(given.has(fold(words.at(-1))) && words.length===2){firstName=words[1];lastName=words[0];}
  else return null;
  return {firstName,lastName,publishedName:value.trim(),identity:fold(firstName+' '+lastName)};
}
function readable($,el) {
 const c=$(el).clone(); c.find('br').replaceWith('\n'); c.find('h1,h2,h3,h4,h5,h6,p,div,td,th,li,span,strong,b,a').each((_,e)=>{$(e).before('\n');$(e).after('\n');});return c.text().replace(/\r/g,'').split('\n').map(t=>t.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}
export function namesInBlock($,el) {
 const text=readable($,el); const names=new Map();
 for(const line of text.split('\n')){
   let fragments=[line,line.split(/\s+[–—|]\s+/u)[0],line.replace(/(?:e-?mail|telefon|tel\.)\s*:.*/iu,'').split(/\s+[–—]\s+/u)[0]];
   if(/\b(?:Mgr|Ing|Bc|PhDr|RNDr|PaedDr|MgA)\./.test(line))fragments.push(...line.matchAll(/(?:Mgr|Ing|Bc|PhDr|RNDr|PaedDr|MgA)\.\s+[\p{Lu}][\p{L}\p{M}'’-]+(?:\s+[\p{Lu}][\p{L}\p{M}'’-]+){1,3}/gu));
   for(const f of fragments){const n=parseName(Array.isArray(f)?f[0]:String(f));if(n)names.set(n.identity,n);}
 }
 return [...names.values()];
}
const emailRe=/[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const allEmails = s => [...new Set((normalizePublishedEmail(s).match(emailRe)??[]).map(normalizePublishedEmail).filter(validEmail))];
function roleFrom(text){return text.split('\n').find(l=>/ředitel|zástup|učitel|koordinátor|pedagog|vychovatel|asisten|porad|metodik|hospodář|ekonom|psycholog|správa/i.test(l)&&!l.includes('@')&&l.length<120)??'';}
export function extractContacts(html,url){
 const $=cheerio.load(html);$('script,style,noscript,template,svg,[hidden],[aria-hidden="true"],iframe').remove();
 const accepted=[],review=[],items=[]; const seen=new Set();
 const main=$('main,#main,#content,article').first(); const root=main.length?main:$('body');
 $('a[href]').each((_,el)=>{const href=$(el).attr('href')??'';if(!/^mailto:/i.test(href))return;const email=normalizePublishedEmail(href);if(validEmail(email))items.push({el,email,kind:'MAILTO',publishedEmail:href});});
 root.find('*').addBack().contents().each((_,node)=>{if(node.type!=='text'||!node.data)return;for(const email of allEmails(node.data))items.push({el:node.parent,email,kind:node.data.includes('@')?'TEXT':'OBFUSCATED',publishedEmail:node.data.trim()});});
 for(const item of items){
   if(GENERIC_MAILBOXES.has(item.email.split('@')[0]))continue;
   let cur=$(item.el);let best=null;let reason='NAME_NOT_RESOLVED';
   for(let depth=0;depth<7&&cur.length;depth++,cur=cur.parent()){
     const tag=cur[0].name;if(['html','body','main','footer','nav','header'].includes(tag))break;
     const text=readable($,cur);if(text.length>1800)break;
     const mails=new Set(allEmails(text));cur.find('a[href^="mailto:" i]').each((_,a)=>mails.add(normalizePublishedEmail($(a).attr('href'))));
     if([...mails].some(e=>e!==item.email)){reason='MULTIPLE_MAILBOXES';break;}
     const names=namesInBlock($,cur);if(names.length>1){reason='MULTIPLE_PEOPLE';break;}
     if(names.length===1){best={...names[0],email:item.email,publishedEmail:item.publishedEmail,sourceUrl:url,role:roleFrom(text),evidenceText:text.slice(0,1200),method:'DOM_SINGLE_PERSON_SINGLE_MAILBOX',sourceKind:item.kind};break;}
   }
   const key=item.email+'|'+(best?.identity??reason);if(seen.has(key))continue;seen.add(key);
   if(best)accepted.push(best);else review.push({email:item.email,sourceUrl:url,reason});
 }
 // Explicit staff sections split by a heading or horizontal separator, not arbitrary nearest text.
 root.find('h2,h3,h4,h5,h6,p').each((_,start)=>{
  const person=parseName($(start).text().trim());if(!person)return;
  const fragments=[$(start).clone()];let next=$(start).next();
  for(let count=0;count<6&&next.length;count++,next=next.next()){
   if(/^(?:hr|h[1-6])$/i.test(next[0].name))break;
   if(parseName(next.text().trim())||next.find('h2,h3,h4,h5').length)break;
   fragments.push(next.clone());
   const box=$('<section></section>');for(const part of fragments)box.append(part.clone());
   const text=readable($,box);if(text.length>900)break;
   const ems=new Set(allEmails(text));box.find('a[href^="mailto:" i]').each((_,a)=>ems.add(normalizePublishedEmail($(a).attr('href'))));
   if(ems.size>1)break;if(ems.size===1){const email=[...ems][0];if(!validEmail(email)||GENERIC_MAILBOXES.has(email.split('@')[0]))break;
    const ns=namesInBlock($,box);if(ns.length!==1||ns[0].identity!==person.identity)break;
    accepted.push({...person,email,publishedEmail:email,sourceUrl:url,role:roleFrom(text),evidenceText:text,method:'EXPLICIT_HEADING_SECTION',sourceKind:'TEXT_OR_MAILTO'});break;}
  }
 });
 const profiles=[];root.find('button').each((_,b)=>{if(/zobrazit profil|profil zaměstnance|detail učitele/i.test($(b).text()))profiles.push({name:$(b).find('h2,h3,h4').first().text().trim(),text:$(b).text().trim().slice(0,150)});});
 const directoryNames=new Set();root.find('tr,h2,h3,h4,h5,strong,b').each((_,el)=>{const ns=namesInBlock($,el);if(ns.length===1)directoryNames.add(ns[0].identity);});
 const refs=[...new Set(accepted.map(x=>x.identity))];
 return {contacts:accepted,review,profiles,directoryNames:[...directoryNames],matchedNames:refs};
}
export function dedupeContacts(contacts){
 const by=new Map();for(const c of contacts){const a=by.get(c.email)??[];a.push(c);by.set(c.email,a);}
 const good=[],conflicts=[];
 for(const [email,items]of by){if(new Set(items.map(x=>x.identity)).size>1){conflicts.push({email,reason:'SHARED_OR_CONFLICTING_PERSON',identities:[...new Set(items.map(x=>x.identity))]});continue;}
 const selected=items[0];good.push({...selected,sources:[...new Set(items.map(x=>x.sourceUrl))],evidenceHash:createHash('sha256').update(selected.evidenceText).digest('hex')});}
 return {contacts:good,conflicts};
}
