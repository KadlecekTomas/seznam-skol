# Dependency audit

Kontrola byla provedena během MVP vývoje 30. 9. 2026 pomocí `npm audit`.

## Aktuální stav

Audit hlásí 4 high-severity záznamy v dependency stromu Prisma:

- `prisma`
- `@prisma/config`
- `deepmerge-ts`
- `mysql2`

## Kontext

Projekt používá PostgreSQL, nikoliv MySQL. Advisories v `mysql2` tedy nejsou na runtime cestě naší databáze, ale balíček se nachází v dependency stromu Prisma CLI.

`deepmerge-ts` advisory se týká stack exhaustion při merge rekurzivních object graphů v Prisma config dependency.

To není důvod advisory ignorovat. Zároveň není vhodné automaticky přejít na starší major verzi Prisma jen proto, že `npm audit` nabízí downgrade jako fix.

## Release gate

Před produkčním nasazením:

1. znovu spustit `npm audit`,
2. ověřit aktuální opravenou verzi Prisma,
3. aktualizovat Prisma pokud je kompatibilní,
4. znovu spustit schema validation, typecheck a celý test suite,
5. nepouštět neověřený upgrade přímo do produkce.

Aktuálně je problém evidovaný, nikoliv skrytý.
