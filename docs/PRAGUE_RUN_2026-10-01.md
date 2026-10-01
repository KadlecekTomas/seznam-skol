# Praha: skutečný plošný průchod 1. 10. 2026

## Předaný rozsah

První automatický pokus proběhl pro všech **509 organizací**, které v pražském výstupu MŠMT provozují základní nebo střední školu. Nejde o 509 jednotlivých pracovišť: 290 organizací provozuje ZŠ, 188 SŠ a 31 obě kategorie.

Po doplnění oficiálních webových odkazů z ARES, opakovaných pokusech, prohlížečové kontrole vybraných stránek a odstranění sporných vazeb:

| Metrika | Výsledek |
|---|---:|
| Organizace se skutečným prvním pokusem | 509 |
| Kontaktní záznamy v hlavním souboru | 10 348 |
| Organizace s přijatým kontaktem | 359 |
| Prověřený web, ale žádný přijatý kontakt | 80 |
| Nevyřešený web | 70 |
| Unikátní e-mailové adresy | 10 297 |
| Unikátní vazby osoba–škola | 10 295 |
| Zdrojové stránky přijatých kontaktů | 812 |
| Karanténované kandidátní vazby | 340 |
| Zachované záznamy z předchozího pilotu | 142 |
| Dřívější kontakty v tomto běhu znovu nepotvrzené | 58 |

**Počet navštívených organizací není důkaz úplnosti personálních seznamů. Žádná organizace není v tomto plošném běhu automaticky prohlášena za úplně zpracovaný personální seznam.**

## Zdrojový základ

MŠMT: https://lkod-ftp.msmt.gov.cz/00022985/21e5fd4a-5378-4d64-90e9-759b15d01f28/RSSZ-Hl-m-Praha.jsonld

Doplňkové veřejné rejstříkové webové adresy: ARES `ekonomicke-subjekty-rs/{ICO}`, vždy kontrola shody IČO i RED IZO. 489 z 509 záznamů poskytlo webový odkaz. Z tohoto API se ukládají pouze údaje identifikující školu a její web, nikoli osobní adresy statutárních osob.

## Jak vzniká kontakt

- E-mail musí být doslovně zveřejněný: mailto, viditelný text či jednoznačně napsaná obfuskace. Žádné dopočítání z domény a jména.
- Párování vyžaduje jednoho člověka a jednu schránku v konkrétním DOM bloku, oddělené profilové sekci nebo skutečně otevřeném veřejném profilu.
- Nevyřešená jména, sdílené schránky a shodné schránky přiřazené několika organizacím na společném webu nejsou tiše převáděny na nové osoby.
- Pojmenovaní zástupci rodičů a studentů jsou oddělení od pracovních kontaktů.
- Výsledek může obsahovat veřejné pracovní kontakty externích spolupracovníků školy, například pověřence pro ochranu osobních údajů. Není to seznam pouze učitelů nebo pracovních poměrů.
- `Datum sebrání` se zachovalo u 142 záznamů staršího pilotu. Dalších 58 se předává odděleně jako znovu nepotvrzené, nikoli automaticky neplatné.

## Chodovická a identita organizace

FZŠ Chodovická je v tomto běhu vázaná na **RED IZO 600040429 / IČO 49625195**, nikoli hledaná podřetězcem názvu. Na stejné ulici je jiná organizace, kterou nelze zaměnit za FZŠ. Nesprávně přiřazený mezivýsledek prohlížečového seedování byl v průběhu práce izolován do karantény a není součástí exportu.

Pro FZŠ znovu otevřeno 63 z 63 zveřejněných profilových karet. 61 různých lidí, 60 e-mailových vazeb z profilu, dalších 5 z kontaktů školy: **65 kontaktů**. To je kontrola těchto veřejných stránek, nikoli potvrzení všech zaměstnanců.

## Spuštění a uložené výsledky

Stávající TypeScript/Prisma pipeline zůstává zachovaná. Nový `src/batch/` je souborová checkpoint pipeline, která nevyžaduje spuštěný Docker/PostgreSQL. V této iteraci nebyla dokončena databázová integrace.

```bash
npm run test:batch
node --import tsx src/batch/run.mjs --input=data/prague-2026-10-01/schools.json --workers=6 --pages=20 --out=data/prague-2026-10-01/full
node --import tsx src/batch/registry-websites.mjs
node --import tsx src/batch/recover.mjs
node --import tsx src/batch/browser-pass.mjs 100
node --import tsx src/batch/assemble.mjs
```

Doplňkové skripty jsou v této verzi určené pro doložený snapshot `data/prague-2026-10-01`, nejde ještě o univerzální plánovaný produkční servis. `browser-pass` vyžaduje kompatibilní dostupný `agent-browser`; podporuje výslovně rozpoznané profily, otevřené `details` a vykreslený DOM. Není univerzálním klikacím agentem pro libovolný školní web.

Běhy mají omezenou paralelizaci, timeouty, rozpočty a checkpoint soubor po každé škole. Síťová vrstva zachovává významové query parametry, kontroluje veřejné DNS adresy před spojením, omezuje přesměrování a čte odpovědi s velikostním limitem. Nedostupné robots.txt neznamená automatické povolení sběru. Dokumenty a nepodporované dynamické prvky jsou vykázané jako mezery.

## Ověření

Lokálně na připojeném Macu:

- generování Prisma klienta: úspěch;
- TypeScript: úspěch;
- původní Vitest: 43/43;
- pilotní nativní testy: 40/40;
- nové dávkové testy: 40/40;
- manifest prvního živého běhu: všech 509 organizací zpracováno;
- export obsahuje 7 požadovaných obchodních sloupců, zdroje jsou samostatně;
- referenční SHA-256 hlavního finálního CSV: `fa87ed3fb1ec03ca7948fb7cd5685c7a1a5499c1c16f9149ef865361ad4004b2`.

Tyto testy neznamenají 100% přesnost párování, doručitelnost schránek, bezchybnou bezpečnost celé aplikace ani úspěšné GitHub CI. Stávající dependency audit a nasazení je potřeba dořešit před produkčním provozem.

## Soukromí a omezení

Skutečné kontakty, podklady a exporty zůstávají mimo veřejný Git. Repository obsahuje jen kód a agregovanou dokumentaci. Primární soukromé výsledky jsou v `data/prague-2026-10-01/`.

Zveřejnění kontaktu není souhlas s obchodním oslovením. Nebylo odesláno žádné sdělení a nebylo prováděno SMTP probing. Pole doručitelnosti je neověřené a oprávnění k marketingu neposouzené. Kontaktní stránka dokládá zveřejnění, nikoli aktuální pracovní poměr.
