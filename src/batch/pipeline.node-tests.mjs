import test from 'node:test';import assert from 'node:assert/strict';import {extractPage,splitPublishedName,validEmail,dedupe,normalizedURL} from './extract.mjs';import {publicIP,safeURL}from'./network.mjs';
test('unknown person must never pair with next row',()=>{const html='<table><tr><td>UNKNOWN Person</td><td><a href="mailto:one@example.org">email</a></td></tr><tr><td>Jana Nováková</td><td><a href="mailto:two@example.org">email</a></td></tr></table>';const r=extractPage(html,'https://example.org');assert.deepEqual(r.contacts.map(c=>c.email),['two@example.org']);});
test('multiple hidden-in-markup mailtos exclude broad pairing',()=>{const r=extractPage('<div><p>UNKNOWN Person <a href="mailto:one@example.org">Napsat</a></p><h3>Jana Nováková</h3><a href="mailto:two@example.org">Napsat</a></div>','https://example.org');assert.equal(r.contacts.length,0);});
test('titles never become surname',()=>{assert.equal(splitPublishedName('Bc. Pavla Mašková Rychtářová DiS.').lastName,'Mašková Rychtářová');assert.equal(splitPublishedName('Mgr. Lucie Baloušová, Ph.D.').lastName,'Baloušová');});
test('surname-first and compound surname preserved',()=>{assert.equal(splitPublishedName('PhDr. Slončíková Jana').firstName,'Jana');assert.equal(splitPublishedName('MgA. Libuše Moravcová Myřátská').lastName,'Moravcová Myřátská');});
test('isolated contact card accepted',()=>{const r=extractPage('<article><h3>Jana Nováková</h3><a href="mailto:novakova@example.org">Napsat</a></article>','https://example.org');assert.equal(r.contacts.length,1);assert.equal(r.contacts[0].firstName,'Jana');});
test('script-only mail never exported',()=>assert.equal(extractPage('<script>var x="Jana Nováková jana@example.org"</script>','https://example.org').contacts.length,0));
test('generic mailbox not assigned to a person',()=>assert.equal(extractPage('<p>Jana Nováková info@example.org</p>','https://example.org').contacts.length,0));
test('conflicting link and label quarantined',()=>{const r=extractPage('<article><h3>Jana Nováková</h3><a href="mailto:a@example.org">b@example.org</a></article>','https://example.org');assert.equal(r.contacts.length,0);});
test('shared mailbox excluded',()=>assert.equal(dedupe([{firstName:'Jana',lastName:'Nováková',email:'a@example.org'},{firstName:'Petr',lastName:'Novák',email:'a@example.org'}]).contacts.length,0));
test('emails never generated from a pattern',()=>assert.equal(extractPage('<p>Jana Nováková; e-mail prijmeni@domena</p>','https://example.org').contacts.length,0));
test('query parameters retained',()=>assert.equal(normalizedURL('/?page=staff','https://example.org/'),'https://example.org/?page=staff'));
test('unsafe URL rejected',()=>{for(const u of ['http://127.0.0.1','http://192.168.1.1','ftp://example.org','https://user:pw@example.org'])assert.throws(()=>safeURL(u));});
test('nonpublic IP rejected',()=>{for(const ip of ['127.0.0.1','10.0.0.1','100.64.0.1','::1','fd00::1','::ffff:127.0.0.1','169.254.169.254'])assert.equal(publicIP(ip),false);assert.equal(publicIP('8.8.8.8'),true);});
test('malformed email rejected',()=>{assert.equal(validEmail('a..b@example.org'),false);assert.equal(validEmail('a@-example.org'),false);});

import {csvCell,buildResults}from'./export.mjs';
test('CSV formula injection neutralized',()=>{assert.equal(csvCell('=1+1'),"'=1+1");assert.equal(csvCell('safe;value'),'"safe;value"');});

test('title parser never consumes surname prefixes',()=>{assert.equal(splitPublishedName('Mudroch Jiří').lastName,'Mudroch');assert.equal(splitPublishedName('Ing. Mudrychová Jitka').lastName,'Mudrychová');assert.equal(splitPublishedName('Profesová Anna, Ing.').lastName,'Profesová');assert.equal(splitPublishedName('Mudrová Irena, ak. mal.').lastName,'Mudrová');});
test('role prose and misspelled lowercase surname require review',()=>{assert.equal(splitPublishedName('Jiří Řebíček majitel firmy JIPE'),null);assert.equal(splitPublishedName('Veronika popová'),null);});
test('generational suffix remains in source not surname',()=>assert.equal(splitPublishedName('Jana Kosová ml.').lastName,'Kosová'));
