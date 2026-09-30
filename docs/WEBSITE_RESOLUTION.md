# Ověření webu školy

## Cíl

Ke každé škole potřebujeme jeden canonical oficiální web.

Samotná podobnost názvu domény nestačí. Stav `VERIFIED` musí vzniknout až po ověření obsahu webu proti identitě školy.

## Pořadí discovery

1. web explicitně uvedený autoritativním zdrojem,
2. doména zveřejněného registry e-mailu jako **kandidát**,
3. veřejný discovery/search fallback,
4. ruční kontrola jen pro zbylé problematické školy.

## Kandidát z e-mailu

Příklad:

```text
info@zsabc.cz
→ candidate https://zsabc.cz
```

Toto není důkaz, že jde o oficiální web.

Freemail domény se ignorují:

```text
gmail.com
seznam.cz
email.cz
centrum.cz
outlook.com
...
```

## Verifikace kandidáta

Kandidát se stane VERIFIED až po kombinaci signálů, například:

- název školy na homepage,
- adresa nebo významná část adresy,
- RED IZO / IČO, pokud jej web zveřejňuje,
- kontaktní e-mail z registru na webu,
- canonical redirect na stejnou organizaci.

Jeden slabý signál nestačí.

## Anti-pattern

Zakázáno:

```text
info@zsabc.cz → automaticky uložit website = zsabc.cz, VERIFIED
```

Správně:

```text
info@zsabc.cz
→ candidate zsabc.cz
→ fetch
→ identity check
→ VERIFIED / INVALID / UNKNOWN
```

Tím snižujeme počet vyhledávání, ale neobětujeme přesnost.
