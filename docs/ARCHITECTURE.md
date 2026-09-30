# Architektura

## 1. Cíl návrhu

Systém má automaticky:

1. získat autoritativní seznam škol,
2. určit oficiální web každé školy,
3. projít pouze relevantní veřejné stránky,
4. vytáhnout konkrétní osoby a jejich zveřejněné pracovní e-maily,
5. ověřit kvalitu a původ dat,
6. uložit historii,
7. exportovat pouze použitelné kontakty.

První region je Praha. Region ale musí být parametr pipeline, nikoliv součást business logiky.

---

## 2. Navržený stack

### Runtime
- Node.js
- TypeScript

### Databáze
- PostgreSQL
- Prisma

### HTTP / HTML
- standardní HTTP klient pro statické stránky
- HTML parser typu Cheerio

### Browser fallback
- Playwright pouze pro stránky, které kontakt vykreslují klientsky a bez browseru jej nelze získat

### AI fallback
- strukturovaný JSON výstup
- pouze nad omezeným textovým výřezem relevantní stránky
- AI nesmí vytvářet nebo domýšlet e-mailové adresy

### Export
- CSV jako nejjednodušší systémový formát
- XLSX pro běžnou obchodní práci

---

## 3. Moduly

```text
src/
  registry/
    importer
    normalizer

  schools/
    website-resolver
    school-service

  crawler/
    queue
    fetcher
    sitemap
    page-priority
    browser-fallback

  extraction/
    email-extractor
    person-parser
    ai-extractor
    normalizer

  validation/
    email-validator
    association-validator
    deduplicator
    quality-classifier

  persistence/
    repositories
    prisma

  export/
    csv
    xlsx

  cli/
    import-schools
    crawl
    export
```

---

## 4. Tok jednoho záznamu

### A. Import školy

Registry adapter vytvoří nebo aktualizuje školu:

```text
external id
název
typ školy
adresa
region
IČO / RED_IZO, pokud je zdroj poskytuje
```

### B. Resolver webu

Preferujeme web uvedený autoritativním zdrojem.

Pokud chybí, resolver může hledat kandidáty. Kandidát musí být ověřen proti identitě školy, typicky názvem, adresou nebo jiným jednoznačným údajem.

Výsledkem není pouze URL, ale i:

```text
website
website_status
website_source
website_verified_at
```

### C. Crawl

Crawler nejprve zkouší:

- `robots.txt`
- `sitemap.xml`
- odkazy z homepage

Vysoce prioritní názvy cest / anchor textů:

```text
kontakt
kontakty
vedení
vedeni
zaměstnanci
zamestnanci
pedagogický sbor
pedagogicky-sbor
učitelé
ucitele
o škole
o-skole
```

Crawler nemá bezdůvodně procházet aktuality, fotogalerie nebo celý historický obsah webu.

### D. Extrakce

1. Regex / parser najde e-mail.
2. Získá lokální DOM kontext kolem e-mailu.
3. Deterministický parser se pokusí najít osobu a funkci.
4. Pokud je blok nejednoznačný, použije se AI fallback.
5. Výstup se validuje.

### E. Uložení

Každé nalezení vytváří evidenci zdroje. Kontakt samotný se deduplikuje, ale provenance se nezahazuje.

---

## 5. AI kontrakt

AI dostává pouze obsah, který crawler již označil jako potenciálně relevantní.

Příklad vstupu:

```text
VEDENÍ ŠKOLY

Mgr. Jana Nováková
ředitelka školy
novakova@skola.cz
```

Příklad výstupu:

```json
{
  "firstName": "Jana",
  "lastName": "Nováková",
  "email": "novakova@skola.cz",
  "role": "ředitelka školy",
  "evidence": "explicit"
}
```

Zakázané chování:

- generovat e-mail ze jména,
- doplňovat chybějící příjmení,
- spojit e-mail s osobou jen podle pořadí, pokud DOM struktura není jednoznačná,
- považovat obecný e-mail školy za osobní kontakt.

---

## 6. Crawl běh

Každý běh má vlastní `crawl_run`.

Díky tomu lze později odpovědět:

- kdy byl kontakt poprvé nalezen,
- kdy byl naposledy potvrzen,
- na jaké URL byl nalezen,
- ve kterém běhu zmizel,
- jestli došlo ke změně funkce nebo e-mailu.

---

## 7. Idempotence

Opakované spuštění stejného importu nebo crawleru nesmí vytvářet duplicitní školy ani kontakty.

Klíče:

- škola: externí registry ID, případně stabilní interní identity map
- osoba: neřešit jako globálně unikátní entitu jen podle jména
- kontakt: primárně normalizovaný e-mail v kontextu školy
- source observation: kontakt + URL + crawl run

---

## 8. Výkon

Pro MVP není potřeba distribuovaná infrastruktura.

Dostačuje:

- fronta škol v DB,
- omezená paralelizace,
- timeouty,
- retry s backoffem,
- domain-level rate limiting.

Browser fallback je výrazně dražší než statický HTTP fetch a musí se používat pouze tam, kde je skutečně potřeba.

---

## 9. Co do MVP nepatří

- automatické rozesílání e-mailů,
- CRM dashboard,
- lead scoring,
- generování personalizovaných kampaní,
- celoplošné crawlování celého webu školy,
- odhadování e-mailových adres.

Nejdřív musíme prokázat kvalitu datasetu.
