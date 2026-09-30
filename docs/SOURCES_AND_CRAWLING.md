# Zdroje a crawl policy

## 1. Hierarchie zdrojů

### Tier 1 — autoritativní registry

Použití:

- identita školy,
- oficiální název,
- typ školy,
- adresa,
- stabilní registry identifikátory.

Primární registry adapter bude implementován odděleně od crawleru, aby šel zdroj později vyměnit nebo rozšířit.

### Tier 2 — oficiální web školy

Použití:

- web školy,
- konkrétní osoby,
- funkce,
- zveřejněné pracovní e-maily.

Toto je preferovaný zdroj pro vazbu osoba ↔ e-mail.

### Tier 3 — veřejná strukturovaná data zřizovatelů

Použití:

- doplnění nebo cross-check údajů,
- případně rychlejší seed kontaktů.

Data se nesmí slepě přepisovat přes Tier 1/Tier 2 bez provenance.

### Tier 4 — vyhledávače / veřejné discovery zdroje

Použití pouze k nalezení kandidáta na oficiální web nebo chybějící relevantní stránku.

Výsledek vyhledávače sám o sobě není dostatečným důkazem pro VERIFIED kontakt.

---

## 2. Co crawler smí navštěvovat

Pouze veřejně dostupné stránky bez přihlášení.

Crawler:

- respektuje `robots.txt`,
- používá omezenou paralelizaci,
- používá rate limit per domain,
- má timeout,
- nezkouší obcházet CAPTCHA,
- neobchází WAF ani jiné ochrany,
- nevstupuje do neveřejných administrací,
- nepoužívá získané session cookies třetích osob.

---

## 3. Crawl budget

Na jednu školu nastavíme crawl budget.

MVP návrh:

- homepage,
- sitemap pokud existuje,
- prioritní kontaktní stránky,
- omezený počet dalších relevantních interních URL.

Cílem není archivovat celý web.

Důvod:

- nižší provoz,
- rychlejší běh,
- nižší AI náklady,
- méně nerelevantního obsahu,
- menší riziko falešných vazeb.

---

## 4. Prioritizace URL

Vysoká priorita:

```text
kontakt
kontakty
vedení
vedeni
zaměstnanci
zamestnanci
pedagogové
pedagogove
pedagogický sbor
pedagogicky-sbor
učitelé
ucitele
pracovníci
pracovnici
o škole
o-skole
```

Nízká priorita:

```text
aktuality
fotogalerie
jídelníček
jidelni-listek
archiv
projekty
výsledky soutěží
```

Nízká priorita neznamená absolutní zákaz. Jen se na ni nespotřebovává crawl budget bez důvodu.

---

## 5. Fetch strategie

### Fáze 1 — Static fetch

Použít standardní HTTP požadavek.

Pokud relevantní obsah je v HTML, browser se nespouští.

### Fáze 2 — Browser fallback

Playwright použít pouze pokud:

- stránka je JS-rendered,
- statický HTML neobsahuje kontakt, který je po načtení viditelný,
- nebo je navigace nutná pro získání veřejného obsahu.

Browser fallback musí být metrikou, protože výrazně zvyšuje cenu a čas.

---

## 6. E-mail obfuscation

Crawler může dekódovat běžné veřejné prezentace adres, pokud jde jednoznačně o zveřejněný kontakt, například:

```text
jan.novak [at] skola.cz
jan.novak (zavináč) skola.cz
```

Musí však být zachováno, že výsledná adresa byla získána z explicitně zveřejněné informace, nikoliv odhadem podle vzoru.

---

## 7. Zdrojové URL

Každý VERIFIED kontakt musí mít minimálně jednu `sourceUrl`.

Zdroj musí být co nejkonkrétnější.

Preferujeme:

```text
https://skola.cz/kontakty/pedagogicky-sbor
```

místo:

```text
https://skola.cz/
```

pokud je kontakt dostupný na konkrétní podstránce.

---

## 8. Historie

Pokud kontakt při dalším běhu zmizí:

1. nemaže se,
2. aktualizuje se stav ověření,
3. po definované politice může přejít do STALE,
4. hlavní export může STALE kontakty vynechat.

Tím nevzniká falešný dojem, že historický kontakt nikdy neexistoval.

---

## 9. Použití dat

Projekt je zaměřen na sběr veřejně zveřejněných pracovních kontaktů a jejich provenance.

Automatizované obchodní rozesílání je samostatná funkční a compliance vrstva a není součástí MVP crawleru.

Před napojením na outbound systém je potřeba samostatně definovat pravidla použití, evidence oslovení, odhlášení a další povinnosti podle aktuálně platného právního rámce.
