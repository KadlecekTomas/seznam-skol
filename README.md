# Seznam škol

Datová pipeline pro sběr a průběžné ověřování veřejně zveřejněných pracovních kontaktů ze základních a středních škol.

## Cíl

První produkční rozsah je **Praha, ZŠ + SŠ**. Architektura ale nesmí být navázaná na Prahu; region má být pouze filtr, aby bylo možné později spustit stejný proces pro celou ČR.

Hlavní export obsahuje pouze použitelné kontakty:

| Pole | Povinné |
| --- | --- |
| Jméno | ano |
| Příjmení | ano |
| E-mail | ano |
| Škola | ano |
| Adresa školy | ano |
| Web školy | ano |
| Datum sebrání | ano |

Interně se navíc ukládá role/funkce, zdrojová URL, datum poslední kontroly, stav kvality a identifikátory školy.

## Zásadní pravidlo

**E-mail se nikdy negeneruje ani neodhaduje.**

Například pokud web uvádí „Jan Novák“ a zároveň pouze obecný vzor e-mailů, systém nesmí vytvořit `jan.novak@skola.cz`. Do hlavního exportu se dostanou pouze kontakty, u kterých je konkrétní e-mail veřejně zveřejněn a lze jej jednoznačně přiřadit konkrétní osobě.

## MVP pipeline

```text
oficiální registr škol
        ↓
master seznam škol
        ↓
nalezení / ověření oficiálního webu
        ↓
crawler relevantních stránek
        ↓
deterministická extrakce e-mailů a okolního textu
        ↓
AI fallback pro strukturování nejednoznačného obsahu
        ↓
validace + deduplikace + provenance
        ↓
PostgreSQL
        ↓
CSV/XLSX export
```

AI není primární crawler. Používá se pouze tam, kde klasický parser nedokáže bezpečně propojit osobu, funkci a zveřejněný e-mail.

## První validační běh

Nejdřív spustíme pilot na přibližně **20–30 pražských školách**. Nejdůležitější metrika není počet stažených stránek, ale:

> kolik validních kombinací `jméno + příjmení + konkrétní zveřejněný e-mail` získáme na jednu školu.

Teprve po ověření kvality se spustí celá Praha.

## Dokumentace

- [Architektura](docs/ARCHITECTURE.md)
- [Datový model](docs/DATA_MODEL.md)
- [Pravidla kvality](docs/QUALITY_RULES.md)
- [Zdroje a crawl policy](docs/SOURCES_AND_CRAWLING.md)
- [Roadmapa](docs/ROADMAP.md)

## Implementační principy

- TypeScript jako hlavní jazyk.
- Deterministické parsování před AI.
- Idempotentní importy a opakovatelné crawl běhy.
- Každý kontakt musí mít dohledatelný zdroj.
- Historie se nemaže jen proto, že kontakt z webu zmizel.
- Hlavní export obsahuje pouze validní kontakty.
- Public-only crawling: žádné přihlašování, obcházení ochran ani neveřejné zdroje.

## Oprava pokrytí Chodovické

Viz [zjištěná příčina, živé výsledky a omezení browser modulu](docs/CHODOVICKA_CORRECTION.md). Samotné nalezení kontaktů neznamená úplné pokrytí školy.

## Plošný průchod Prahy 1. 10. 2026

Všech 509 rejstříkových organizací dostalo první pokus o zpracování; soukromý export obsahuje 10 348 kontaktů z 359 organizací. Úplnost personálních seznamů se tím nepotvrzuje. Podrobnosti, omezení a spuštění jsou v [protokolu plošného průchodu](docs/PRAGUE_RUN_2026-10-01.md).
