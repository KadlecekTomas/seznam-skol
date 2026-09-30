import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export function csvCell(value) {
  let text = String(value ?? '');
  // Quoting alone does NOT prevent Excel formula execution.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/gu, '""') + '"';
}
export function csvTable(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
export const MAIN_HEADERS = ['Jméno','Příjmení','E-mail','Škola','Adresa školy','Web','Datum sebrání'];
export const mainRows = contacts => contacts.map(c => [c.firstName,c.lastName,c.email,c.schoolName,c.schoolAddress,c.schoolWebsite,c.collectedAt]);

export async function writePilot(result, outputDirectory) {
  const out = resolve(outputDirectory);
  await mkdir(out, {recursive:true});
  const files = {
    'kontakty.csv': csvTable(MAIN_HEADERS, mainRows(result.contacts)),
    'overeni.csv': csvTable([...MAIN_HEADERS,'Funkce','Zdroj kontaktu','Zdroj adresy','Poslední kontrola','Stav','Metoda sběru'],
      result.contacts.map(c => [...mainRows([c])[0],c.role,c.sources.join(' | '),c.addressSourceUrl,c.lastObservedAt,c.status,c.collectionMethod])),
    'skoly.csv': csvTable(['Škola','Typ','Adresa','Web','Zdroj adresy','Potvrzené kontakty','Poznámka'],
      result.schools.map(s => [s.name,s.type,s.address,s.website,s.addressSourceUrl,s.confirmedContacts,s.note])),
    'ke-kontrole.csv': csvTable(['Klíč školy','Jméno','E-mail','Důvod','Zdroj','Alternativní adresy'],
      result.review.map(r => [r.schoolKey,r.name ?? `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),r.email,r.reason,r.sourceUrl,(r.alternatives ?? r.alternateEmails ?? []).join(' | ')])),
    'summary.json': JSON.stringify(result.summary,null,2)+'\n',
    'ledger.json': JSON.stringify(result.ledger,null,2)+'\n',
    'pilot.json': JSON.stringify(result,null,2)+'\n',
  };
  // Refuse to overwrite existing delivery artifacts. A replay uses a new directory.
  for (const [file, contents] of Object.entries(files)) await writeFile(join(out,file), contents, {encoding:'utf8', flag:'wx', mode:0o600});
  return {outputDirectory: out, files: Object.keys(files)};
}
