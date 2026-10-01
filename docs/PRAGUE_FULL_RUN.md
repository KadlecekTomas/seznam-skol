# Praha: plošný průchod 1. 10. 2026

## Skutečně provedený rozsah

Živý JSON-LD rejstřík MŠMT k 1. 10. 2026: 509 různých organizací provozujících ZŠ/SŠ se sídlem Praha. Nejde o počet budov ani o celostátní rozsah.

- Zpracováno 509/509 rejstříkových subjektů.
- Potvrzený web: 471 subjektů; 38 zůstává bez potvrzeného dostupného webu.
- Kontaktní záznamy: 11 844 z 382 subjektů.
- Různé e-mailové adresy: 11 527. Tentýž člověk či schránka může být uveden u více škol; počet řádků není počet různých lidí.
- Zpracováno 6 038 statických HTML stránek a 508 prohlížečových načtení.
- 261 škol prošlo prohlížečovým doplněním.
- FZŠ Chodovická (RED IZO 600040429): znovu 63/63 otevřených veřejných karet, 61 různých profilových jmen, 60 profilů s e-mailem. Po doplnění kontaktní stránky 65 kontaktů.

## Co znamená kvalita

Záznamy jsou automaticky spárované s explicitně zveřejněnými údaji na potvrzeném školním webu. Nikoli ověření doručitelnosti, aktuálního pracovního poměru nebo oprávnění k obchodnímu oslovení.

Kontrola reprezentativnosti nebyla provedena. Orientační ruční kontrola 40 kontaktů z různých škol zkoumala uloženou zdrojovou evidenci, nikoli celé personální seznamy škol. Není to důkaz přesnosti všech záznamů.

Přehled úplnosti: 302 PARTIAL_COVERAGE, 116 SOURCES_SCANNED_COMPLETENESS_UNCONFIRMED, 52 NO_PERSONAL_CONTACTS, 38 WEB_UNRESOLVED, 1 PROFILE_DIRECTORY_CHECKED. Tyto stavy popisují technický rozsah, nikoli potvrzení kompletního sboru. 11 401 kontrolních položek zahrnuje nejasné bloky a opakované nálezy ze zdrojů; nejde o 11 401 chybějících lidí.

## Implementace

`src/batch/` rozšiřuje původní aplikaci o opakovatelný souborový běh. Každá škola má checkpoint, registry snapshot a neveřejný cache zdrojových stránek. PostgreSQL se v této cestě nepoužívá; původní Prisma pipeline zůstává zachovaná a její integrační průchod tím není potvrzen.

1. `batch:prepare` načte a uloží snapshot škol.
2. `batch:scan` ověřuje web podle rejstříkových údajů; pokud nestačí doména e-mailu, využije explicitní odkaz v oficiálním portálu ČŠI. Prochází prioritní kontaktní stránky a sitemap.
3. `batch:browser` v čistých kontextech doplňuje vykreslený obsah a podporované karty „Zobrazit profil“. Není univerzálním řešením libovolného školního webu.
4. `reparse.mjs` znovu zpracuje uložené skutečně stažené stránky aktuálním parserem bez dalších HTTP požadavků. Původní čas získání se zachová.
5. `batch:export` vytvoří CSV se sedmi obchodními sloupci, podrobný soukromý audit, přehled škol a ledger prvního sběru.

```bash
npm run batch:prepare -- --data=data/praha-2026-10-01
CAPTURE_DIR=data/praha-2026-10-01/http-cache npm run batch:scan -- --data=data/praha-2026-10-01 --workers=8
# Vyžaduje nainstalovaný kompatibilní playwright-core a Chromium.
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs BROWSER_EXECUTABLE=/absolute/path/to/chromium npm run batch:browser -- --data=data/praha-2026-10-01 --once
node --import tsx src/batch/reparse.mjs --data=data/praha-2026-10-01
npm run batch:export -- --data=data/praha-2026-10-01 --output=exports/praha-2026-10-01
# Opakovaný export používá předchozí ledger a nový adresář.
npm run batch:export -- --data=data/praha-2026-10-01 --previous=exports/praha-2026-10-01/ledger.json --output=exports/praha-replay
```

## Konzervativní hranice

- Pouze veřejné pracovní kontakty. Žádné přihlašování, posílání zpráv či obcházení CAPTCHA/WAF.
- Robots před načtením a přesměrováním; nedostupné robots při síťové chybě a serverové blokace se neignorují.
- Statický transport ověřuje a připíná veřejné DNS adresy, omezuje velikost těla během streamování, nastavuje timeouty a prodlevy podle hostitele.
- Prohlížeč nepoužívá osobní cookies a blokuje nesouvisející navigaci, neveřejné adresy a jiné než GET požadavky.
- Sdílené a rozporné e-maily, nejasná jména a více osob v jednom bloku se nevydávají za jednoznačný kontakt.
- Příjmení jako Mudroch nebo Profesová se nesmí zkrátit chybným rozpoznáním titulu MUDr./prof. Regresní testy tento případ pokrývají.
- Výchozí limity: 22 HTML stránek na školu, nejvýše 3 prioritní prohlížečové stránky. Vyčerpaný limit, další stránkování a neotevřené profily zůstávají upozorněním.
- PDF, obrázkové seznamy, libovolné nestandardní modály a některé JS komponenty zatím nejsou univerzálně pokryty. Není tedy garantováno stažení všech zveřejněných kontaktů každé školy.

## Ověření a soukromí

Všechny skutečné kontakty, HTML cache, CSV a exporty jsou mimo veřejný Git (`data/`, `exports/`, `artifacts/`). Kód a syntetické testy jsou veřejné. Množství kontaktů není důvod vynechat před použitím kontrolu zdroje a aktuálnosti.

Lokální ověření: TypeScript, 43 původních Vitest testů, 40 pilotních nativních testů, 18 nových batch testů. Jde o lokální běhy na autorizovaném Macu, nikoli potvrzení GitHub CI či produkčního nasazení.

Zdroje: https://lkod-ftp.msmt.gov.cz/00022985/21e5fd4a-5378-4d64-90e9-759b15d01f28/RSSZ-Hl-m-Praha.jsonld ; https://portal.csicr.cz/ ; konkrétní veřejné školní stránky v neveřejném řádkovém auditu.
