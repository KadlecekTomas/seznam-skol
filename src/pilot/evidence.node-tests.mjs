import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPilot, normalizePublishedEmail, validDate, validEmail, publicHttpUrl } from './evidence.mjs';
import { MAIN_HEADERS, csvCell, csvTable, mainRows, writePilot } from './export.mjs';

const base = () => ({schemaVersion:1, collectionDate:'2026-09-30', collectionMethod:'ASSISTED_PUBLIC_WEB_REVIEW',
 schools:[{key:'synthetic',name:'ZŠ Ukázková',type:'ZŠ',scope:'Praha',address:'Ukázková 1, 110 00 Praha 1',website:'https://school.example.org',addressSourceUrl:'https://school.example.org/kontakty'}],
 observations:[{schoolKey:'synthetic',firstName:'Jana',lastName:'Nováková',email:'jana@school.example.org',publishedName:'Mgr. Jana Nováková',publishedEmail:'jana@school.example.org',role:'učitelka',sourceUrl:'https://school.example.org/kontakty',reviewed:true}],unresolved:[]});
const rejected = (patch, expected) => {const c=base(); Object.assign(c.observations[0],patch); const r=buildPilot(c); assert.equal(r.contacts.length,0); assert.ok(r.review[0].reason.includes(expected));};

test('accepts explicit reviewed publication without claiming delivery or consent',()=>{const r=buildPilot(base()); assert.equal(r.contacts.length,1);assert.equal(r.contacts[0].deliveryVerified,false);assert.equal(r.contacts[0].marketingPermission,'NOT_ASSESSED');});
test('rejects guessed email',()=>rejected({email:'novakova@school.example.org'},'EMAIL_NOT_PUBLISHED'));
test('rejects missing given name',()=>rejected({firstName:''},'MISSING_NAME'));
test('rejects invented name absent from source',()=>rejected({firstName:'Eva'},'NAME_NOT_IN_EVIDENCE'));
test('rejects product names as people',()=>rejected({firstName:'Google',lastName:'Classroom',publishedName:'Google Classroom'},'NON_PERSON_NAME'));
test('supports surname-first source without swapping output',()=>{const c=base();c.observations[0].publishedName='NOVÁKOVÁ Jana';assert.equal(buildPilot(c).contacts[0].firstName,'Jana');});
test('preserves multiple given names and surnames',()=>{const c=base();Object.assign(c.observations[0],{firstName:'Jana Marie',lastName:'Nováková Svobodová',publishedName:'Mgr. Jana Marie Nováková Svobodová'});assert.equal(buildPilot(c).contacts[0].lastName,'Nováková Svobodová');});
test('decodes only explicitly written obfuscation',()=>assert.equal(normalizePublishedEmail(' jana (at) school.example.org '),'jana@school.example.org'));
test('recognizes internationalized address as requiring extra review rather than corrupting it',()=>assert.equal(validEmail('svatoš@school.example.org'),false));
test('rejects malformed address with repeated dots',()=>assert.equal(validEmail('ja..na@school.example.org'),false));
test('rejects malformed labels and excess local length',()=>{assert.equal(validEmail('jana@-school.example.org'),false);assert.equal(validEmail('a'.repeat(65)+'@school.example.org'),false);});
test('does not equate generic mailbox with a named personal contact',()=>rejected({email:'info@school.example.org',publishedEmail:'info@school.example.org'},'GENERIC_MAILBOX'));
test('quarantines conflicting visible address and link target',()=>rejected({alternateEmails:['other@school.example.org']},'CONFLICTING_PUBLISHED_EMAILS'));
test('requires source review flag',()=>rejected({reviewed:false},'SOURCE_REVIEW_REQUIRED'));
test('rejects expired role association',()=>rejected({validUntil:'2026-07-31'},'EXPIRED_ASSOCIATION'));
test('rejects future association',()=>rejected({validFrom:'2027-01-01'},'FUTURE_ASSOCIATION'));
test('requires school provenance rather than a directory result',()=>rejected({sourceUrl:'https://directory.example.org/school'},'NON_OFFICIAL_CONTACT_SOURCE'));
test('rejects URL credentials, non HTTP schemes and local targets',()=>{for(const u of ['file:///tmp/a','http://127.0.0.1','http://localhost','https://user:pass@school.example.org','http://host.local']) assert.equal(publicHttpUrl(u),false);});
test('validates real calendar dates',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);});
test('does not silently change first collection date on replay',()=>{const r=buildPilot(base());const c=base();c.collectionDate='2026-10-01';const next=buildPilot(c,r.ledger);assert.equal(next.contacts[0].collectedAt,'2026-09-30');assert.equal(next.contacts[0].lastObservedAt,'2026-10-01');assert.equal(next.ledger.records.length,1);});
test('deduplicates repeated identical observations',()=>{const c=base();c.observations.push({...c.observations[0]});const r=buildPilot(c);assert.equal(r.contacts.length,1);assert.equal(r.summary.duplicateObservations,1);});
test('quarantines both people sharing a mailbox',()=>{const c=base();c.observations.push({...c.observations[0],firstName:'Petr',lastName:'Dvořák',publishedName:'Petr Dvořák'});const r=buildPilot(c);assert.equal(r.contacts.length,0);assert.equal(r.review.length,2);});
test('does not overwrite prior person after role mailbox reassignment',()=>{const old=buildPilot(base());const c=base();Object.assign(c.observations[0],{firstName:'Petr',lastName:'Dvořák',publishedName:'Petr Dvořák'});const next=buildPilot(c,old.ledger);assert.equal(next.contacts.length,0);assert.equal(next.ledger.records[0].firstName,'Jana');assert.equal(next.ledger.records[0].status,'REVIEW_REQUIRED');});
test('honors suppression list on another import',()=>{const old=buildPilot(base());old.ledger.records[0].suppressed=true;assert.equal(buildPilot(base(),old.ledger).contacts.length,0);});
test('does not delete unseen records on a partial pilot',()=>{const old=buildPilot(base());const c=base();c.observations=[];assert.equal(buildPilot(c,old.ledger).ledger.records.length,1);});
test('refuses duplicate school identities',()=>{const c=base();c.schools.push({...c.schools[0]});assert.throws(()=>buildPilot(c),/duplicate school/u);});
test('does not accept other regions under a Prague label',()=>{const c=base();c.schools[0].scope='Středočeský kraj';assert.equal(buildPilot(c).contacts.length,0);});
test('protects CSV against formulas as well as delimiter injection',()=>{for(const s of ['=1+1',' +2','-2','@SUM(A1)','\t=cmd']) assert.ok(csvCell(s).startsWith('"\''));assert.equal(csvCell('Škola; "A"'),'"Škola; ""A"""');});
test('exports precisely seven requested business columns with BOM',()=>{assert.equal(MAIN_HEADERS.length,7);const rows=mainRows(buildPilot(base()).contacts);assert.equal(rows[0].length,7);assert.ok(csvTable(MAIN_HEADERS,rows).startsWith('\uFEFF'));});
test('CLI artifact export writes ledger and refuses overwriting prior results',async()=>{const dir=await mkdtemp(join(tmpdir(),'skoly-test-'));try {const r=buildPilot(base());await writePilot(r,dir);const report=JSON.parse(await readFile(join(dir,'summary.json'),'utf8'));assert.equal(report.confirmedContacts,1);await assert.rejects(()=>writePilot(r,dir),/EEXIST/u);}finally{await rm(dir,{recursive:true,force:true});}});

test('does not mistake Praha-východ for the city of Prague',()=>{const c=base();c.schools[0].address='Smiřických 2, Škvorec, Praha – Východ';assert.equal(buildPilot(c).contacts.length,0);});
