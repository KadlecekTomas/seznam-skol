# Datový pilot: asistovaná kontrola veřejných kontaktů

## Co je skutečně dodané

K 30. 9. 2026 byl sestaven a softwarově zpracován pilot 25 pražských škol.
Výstup obsahuje 145 doložených vazeb osoba–e-mail z 20 škol (12 ZŠ a 8 SŠ).
Dalších 19 kontrolních položek zůstává mimo hlavní export. Kontrolní položka
může popisovat osobu, sdílenou schránku, skupinu i nedokončenou kontrolu školy;
nejde o počet 19 neplatných e-mailů.

**Jde o asistovaný sběr z dostupného obsahu oficiálních veřejných webů,
ne o dokončený automatický crawl celé Prahy.** Výběr škol ani vybrané kontakty
nejsou reprezentativním odhadem celkové výtěžnosti. Nejde o úplný personální
seznam každé školy. Některé zdroje mohou být načtené z mezipaměti; aktuální
pracovní poměr a doručitelnost schránky nejsou potvrzené školou.

## Proč samostatný modul

Původní TypeScript/Prisma crawler zůstává zachovaný. Nový doprovodný modul
`src/pilot/` umožňuje dokončit kontrolu, deduplikaci a export bez spuštěného
PostgreSQL, bez npm instalace a bez API klíčů. Přijímá již zkontrolované zdrojové
záznamy. Sám nenavštěvuje internet a neřeší dohledání webu školy.

Není to náhrada databázových integračních testů. V tomto kroku nebyl proveden
celý původní průchod import → resolve → crawl → PostgreSQL → export.

## Spuštění (Node.js 22+)

```bash
# Bez instalace závislostí; 31 testů nového pilotního modulu.
npm run test:pilot

# capture.json je neveřejný soubor skutečně zkontrolovaných zdrojových záznamů.
npm run pilot:export -- --input=data/capture.json --output=exports/pilot-2026-09-30

# Další zpracování zachová první datum sběru; použij nový výstupní adresář.
npm run pilot:export -- --input=data/capture.json --previous=exports/pilot-2026-09-30/ledger.json --output=exports/replay-2026-09-30
```

Přímé ekvivalenty jsou `node --test src/pilot/*.node-tests.mjs` a
`node src/pilot/cli.mjs ...`. Přípona `.node-tests.mjs` je záměrná, aby soubory
nebyly současně objevovány jako testy původním Vitestem.

## Vstupní kontrakt

Kořen JSON má `schemaVersion: 1`, `collectionDate` ve formátu YYYY-MM-DD,
`collectionMethod: "ASSISTED_PUBLIC_WEB_REVIEW"`, pole `schools`,
`observations` a volitelné `unresolved`.

Škola obsahuje `key`, `name`, `type` (ZŠ/SŠ/ZŠ+SŠ), `scope: "Praha"`,
`address`, `website`, `addressSourceUrl` a volitelnou `note`.

Pozorování obsahuje `schoolKey`, `firstName`, `lastName`, `email`, `role`,
`publishedName`, `publishedEmail`, `sourceUrl` a `reviewed: true`.
Volitelné `alternateEmails` slouží pro rozporné adresy; `validFrom` a
`validUntil` pro explicitně časově omezenou vazbu.

`publishedName` a `publishedEmail` musejí být doslovné údaje skutečně
zkontrolovaného zdroje, nikoli text vygenerovaný podle požadovaného výsledku.
Samotný příznak `reviewed: true` není důkaz. Kontrolor musí ověřit vazbu osoby,
e-mailu, školy a zdroje; validátor kontroluje konzistenci tohoto záznamu,
ne pravdivost libovolného vstupního JSON.

## Pravidla hlavního exportu

- Jméno i příjmení musejí být ve zdrojové jmenné evidenci. Tituly nejsou jméno.
- E-mail musí být explicitně zveřejněn. Dekódování `(at)` či `[zavináč]` je
  možné; odhad podle jména nebo vzoru domény nikoli.
- Neúplná jména, obecné schránky, rozporné adresy a sdílené schránky několika
  osob se nevydávají za jednoznačné osobní kontakty.
- Stejná schránka nově přiřazená jiné osobě se karanténuje i mezi běhy;
  stará identita není potichu přepsána.
- Česká jména, více křestních jmen a více příjmení se zachovávají. Adresy
  vyžadující SMTPUTF8 zůstávají ke kontrole, nepřepisují se na ASCII odhadem.
- Datum prvního sběru zůstává neměnné; další kontrola mění `lastObservedAt`.
- Potlačený kontakt (`suppressed: true` v ledgeru) se nesmí znovu exportovat.
- CSV má UTF-8 BOM, středník a ochranu buněk před interpretací jako vzorec.

`SOURCE_CONFIRMED` znamená doložené zveřejnění a vazbu. Neznamená úspěšné
SMTP ověření, aktuálnost zaměstnání ani souhlas s obchodním oslovením.
Kontakty vždy nesou `deliveryVerified: false` a
`marketingPermission: "NOT_ASSESSED"`. URL kontrola v tomto offline modulu
je pouze kontrola formátu a hostitele, nikoli síťové/DNS bezpečnostní ověření.

## Výstupní soubory

`kontakty.csv` obsahuje přesně požadovaných sedm sloupců:

```text
Jméno;Příjmení;E-mail;Škola;Adresa školy;Web;Datum sebrání
```

`overeni.csv` přidává funkci, přesné zdrojové URL, poslední kontrolu a metodu.
`skoly.csv` uvádí i školy bez exportovaného kontaktu. `ke-kontrole.csv` obsahuje
výjimky odděleně. `summary.json`, `ledger.json` a `pilot.json` umožňují audit
počtů a opakované zpracování. Výstup se zapisuje exkluzivně a nepřepisuje
existující soubory; neúspěšný běh může zanechat částečný adresář, který se
nemá vydávat za dokončenou dodávku.

## Skutečné ověření tohoto kroku

- 31/31 testů nového samostatného modulu prošlo v Node.js 22.16.0.
- Finální vstup vytvořil 145 kontaktů, 20 škol s kontakty a 19 kontrolních položek.
- Opakované zpracování se stejným vstupem a předchozím ledgerem vytvořilo
  bajtově identické hlavní CSV. Nevznikly další kontakty ani změny prvního data.
- SHA-256 JSON serializace vstupního capture:
  `71769590df90298b59614db97c0ed8ef412f55b01a84d068ff51f93c955768ba`.

Tato čísla nejsou výsledek nového běhu původních 40 Vitest testů, PostgreSQL
integrace nebo GitHub CI. Tyto části je nutné ověřit samostatně před produkčním GO.

## Soukromí a další release gate

Repozitář je veřejný. Skutečný `capture.json`, ledger, CSV a Excel jsou
předávány soukromě mimo Git; `.gitignore` chrání `data/`, `exports/` a
`artifacts/`. Testy používají pouze syntetické osoby a domény example.org.

Před plnou automatizací dokončit databázový průchod, reprezentativní pilot
crawleru, kontrolu konfliktních a zastaralých vazeb, bezpečnost síťového
stahování, provozní prostředí a CI. Pravidla dalšího použití kontaktů musí
být stanovena odděleně od jejich technického získání. Žádné e-maily tento
modul nerozesílá.
