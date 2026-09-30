# Import rejstříku MŠMT

## Zdroj

První implementovaný adapter používá veřejný JSON-LD dataset MŠMT pro Hlavní město Praha.

Výchozí URL je definována v:

```text
src/registry/msmt.ts
```

CLI umožňuje URL přepsat přes `--url=...`, takže parser můžeme testovat nebo přesměrovat na novou distribuci bez změny kódu.

## Spuštění

Pouze stažení a kontrola parseru:

```bash
npm run cli -- import-schools --dry-run
```

Import do PostgreSQL:

```bash
npm run cli -- import-schools
```

Statistika DB:

```bash
npm run cli -- stats
```

## Klasifikace

Z provozovaných škol používáme kódy druhu:

- `B00` → základní škola
- `C00` → střední škola

Pokud organizace provozuje obě, ukládá se jako `PRIMARY_AND_SECONDARY` a nevytvářejí se dva duplicitní záznamy organizace.

Organizace bez ZŠ nebo SŠ se v první fázi ignorují.

## Identita

Primární externí identita je RED IZO.

Pokud RED IZO chybí, používáme deterministický fallback:

```text
ico:<IČO>
```

Opakovaný import proto používá upsert a nevytváří stejné školy znovu.

## Registry kontaktní metadata

MŠMT feed může obsahovat:

- obecné e-maily organizace,
- jméno ředitele.

Tyto hodnoty ukládáme odděleně jako:

```text
registryEmails
registryDirectorName
```

**Nikdy automaticky netvrdíme, že registry e-mail patří konkrétnímu řediteli.**

Osobní kontakt se stane VERIFIED až tehdy, když crawler na důvěryhodném veřejném zdroji jednoznačně prokáže vazbu osoba ↔ e-mail.

## Bezpečnost importu

Parser odmítne top-level payload bez:

- `datumVystupu`
- `list`

Záznam organizace se přeskočí, pokud chybí:

- IČO,
- název,
- použitelná adresa,
- ZŠ/SŠ jednotka.

Tím je preferovaná konzervativní chyba (méně dat) před nekvalitním nebo špatně přiřazeným záznamem.
