# Roadmapa

Roadmapa je záměrně orientovaná na co nejrychlejší ověření business hodnoty.

## Fáze 0 — specifikace

- [x] definovat cílový export
- [x] definovat rozdíl collectedAt / lastVerifiedAt
- [x] zakázat generování e-mailových adres
- [x] definovat quality states
- [x] definovat source provenance
- [x] navrhnout modulární architekturu

---

## Fáze 1 — skeleton projektu

Cíl: spustitelný TypeScript projekt bez crawler logiky.

- [ ] Node.js + TypeScript
- [ ] lint / format
- [ ] env validace
- [ ] PostgreSQL + Prisma
- [ ] základní CLI
- [ ] test runner
- [ ] Docker Compose pro lokální DB
- [ ] základní CI

Výstup:

```bash
npm run typecheck
npm test
npm run cli -- --help
```

---

## Fáze 2 — registry import

Cíl: získat master seznam pražských ZŠ/SŠ s adresami.

- [ ] adapter pro autoritativní registry zdroj
- [ ] download/import
- [ ] normalizace adres
- [ ] identifikace ZŠ/SŠ
- [ ] region filter = Praha
- [ ] idempotentní upsert
- [ ] unit testy parseru

Acceptance:

- opakovaný import nevytváří duplicity,
- každá importovaná škola má název a adresu,
- lze vypsat počet ZŠ a SŠ v Praze.

---

## Fáze 3 — website resolver

Cíl: ke škole získat ověřenou canonical URL.

- [ ] použít registry web, pokud existuje
- [ ] normalizace URL
- [ ] kontrola dostupnosti
- [ ] canonical redirect handling
- [ ] candidate resolution pro chybějící weby
- [ ] stav VERIFIED / INVALID / UNKNOWN

Acceptance:

- u každé školy víme, zda má ověřený web,
- resolver nevydává agregátory za oficiální školní web.

---

## Fáze 4 — crawler

Cíl: efektivně najít relevantní stránky.

- [ ] robots parser
- [ ] sitemap parser
- [ ] homepage link discovery
- [ ] URL relevance scoring
- [ ] domain rate limit
- [ ] retry/backoff
- [ ] crawl budget
- [ ] statický fetch
- [ ] Playwright fallback
- [ ] CrawlRun + CrawlPage evidence

Acceptance:

- crawler neprochází bezhlavě celý web,
- umí najít typické stránky kontaktů,
- jednotlivé chyby neshodí celý běh.

---

## Fáze 5 — extrakce kontaktů

Cíl: získat kandidáty osoba + e-mail.

- [ ] mailto parser
- [ ] textový email parser
- [ ] základní obfuscation decoder
- [ ] lokální DOM context
- [ ] person name parser
- [ ] role parser
- [ ] AI fallback se strict JSON schema
- [ ] evidence metadata

Acceptance:

- systém nikdy nevytvoří e-mail, který nebyl explicitně zveřejněn,
- AI nesmí měnit původní e-mail,
- každý kandidát má source URL.

---

## Fáze 6 — validace a deduplikace

- [ ] normalizedEmail
- [ ] syntax validation
- [ ] person/email association rules
- [ ] general mailbox detection
- [ ] quality classifier
- [ ] dedupe per school
- [ ] VERIFIED / INCOMPLETE / STALE / REJECTED
- [ ] ruční QA helper pro pilot

Acceptance:

Hlavní export obsahuje pouze:

```text
jméno
příjmení
email
škola
adresa
web
datum sebrání
```

a každý řádek má interně dohledatelný zdroj.

---

## Fáze 7 — pilot Praha

Vybrat reprezentativních 20–30 škol:

- různé městské části,
- ZŠ i SŠ,
- moderní i staré weby,
- statické i JS weby.

Měřit:

- VERIFIED kontakty / škola,
- precision z ručního QA,
- školy bez kontaktů,
- AI fallback rate,
- browser fallback rate,
- průměrný počet fetchů / škola,
- čas a náklad běhu.

### Rozhodnutí po pilotu

Pokud je precision nízká, **nepouštět celou Prahu**. Opravit association pravidla.

Pokud je precision vysoká, ale recall nízký, zlepšit discovery stránek.

---

## Fáze 8 — celá Praha

- [ ] full run
- [ ] retry failed schools
- [ ] ruční QA vzorku
- [ ] CSV export
- [ ] XLSX export
- [ ] souhrn metrik

---

## Fáze 9 — pravidelný refresh

Až po úspěchu prvního datasetu:

- [ ] incremental crawling
- [ ] content hash
- [ ] lastVerifiedAt
- [ ] STALE politika
- [ ] reporting změn
- [ ] plánované běhy

---

## Pozdější fáze — mimo MVP

- dashboard
- uživatelské účty
- evidence obchodníků
- osloveno / neosloveno
- odpověď / zájem / objednávka
- CRM integrace
- další kraje
- celá ČR

Tyto části mají smysl až poté, co dataset prokáže dostatečnou kvalitu.
