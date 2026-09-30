# Chodovická: oprava neúplného personálního pokrytí

Kontrola: 30. 9. 2026. Tento dokument opravuje rozsah dřívějšího asistovaného pilotu; původních 145 kontaktů nebyl úplný personální seznam jednotlivých škol.

## Příčina

Původní výběr obsahoval pouze 10 kontaktů Chodovické převážně z kontaktní stránky. Statický crawler sice našel stránku sboru, ale neotevřel veřejné profily. E-maily se zobrazují až v detailu karty jako text tlačítka pro kopírování, nikoli jako mailto odkaz. Existence několika správně spárovaných kontaktů tedy nedokazovala pokrytí sboru.

## Živý výsledek opravy

- 63 viditelných profilových karet otevřeno; 61 různých jmen.
- 60 lidí v profilu zveřejňuje e-mail, jeden profil e-mail neuvádí.
- Kontaktní stránka přidává dalších 5 pojmenovaných e-mailových vazeb.
- Celkem 65 kontaktů školy místo původních 10, tedy 55 nových.
- Pět pojmenovaných výjimek zůstává mimo osobní export: tři bez e-mailu a dvě se společnou organizační schránkou.
- Dvě dvojice karet představují různé funkce stejné osoby; nejde o další lidi.
- Opravený soukromý pilot má 200 kontaktů. Ostatních 135 kontaktů se v této opravě nemění a jejich úplnost nebyla znovu posouzena.

Zdroje: https://www.fzschodovicka.cz/skola/pedagogicky-sbor a https://www.fzschodovicka.cz/kontakty . Rozsah znamená zveřejněné profily a pojmenované kontaktní bloky těchto dvou stránek, nikoli potvrzení všech pracovních poměrů či neveřejných kontaktů.

## Implementace

`src/pilot/browser-profiles.mjs` obsahuje samostatnou funkci pro řízené otevírání veřejných profilů v čistém prohlížeči. Zachovává přesné publikované jméno, e-mail a zdroj. Negeneruje adresy a sám neprovádí automatické rozdělení jména/příjmení. Zachycené názvy v obráceném pořadí a více příjmení musí projít jmennou kontrolou před exportem.

Příklad použití s již otevřenou povolenou veřejnou stránkou a nainstalovaným kompatibilním prohlížečovým nástrojem:

```bash
node src/pilot/browser-profiles.mjs | agent-browser --session staff-review --json eval --stdin > data/profile-capture.json
node --test src/pilot/*.node-tests.mjs
```

Nejdříve zkontrolovat robots.txt a povahu stránky. Používat čistý profil bez osobních cookies; nepřihlašovat se a neobcházet blokace. Skript podporuje rozložení s ovládacím prvkem „Zobrazit profil“ a zavíráním „Zavřít“. Není univerzálním prohlížečovým crawlerem všech škol.

`profileCoverage` nedovolí zaměnit chybějící karty, duplicity, jiný otevřený profil nebo vyčerpaný limit za úplné zpracování. Chybějící zveřejněný e-mail je explicitní výjimka, ne důvod adresu odhadnout.

Statický crawler nyní vytváří `profileInventory` a `coverageWarnings` s `BROWSER_PROFILE_REVIEW_REQUIRED`. CLI v takovém případě neoznačí běh jako COMPLETED. Spuštění browser modulu zatím není automaticky zapojené do PostgreSQL pipeline; vyžaduje řízenou kontrolu.

## Ověření

- Generování Prisma klienta a TypeScript typecheck: úspěch.
- Vitest: 43/43 testů (včetně tří nových kontrol inventáře).
- Nativní pilotní testy: 40/40 (včetně devíti nových kontrol pokrytí).
- Přesný nově přidaný browser skript znovu otevřel 63/63 karet, napočítal 61 osob a 60 zveřejněných e-mailových vazeb. Množina e-mailů byla totožná s prvním živým kontrolním průchodem.

Jde o lokální výsledky v Node.js 22.23.2 na připojeném Macu. Nejde o potvrzení GitHub CI ani databázových integračních testů. Žádné skutečné osobní kontakty a exporty se neukládají do veřejného repozitáře.
