# Datový model

Tento dokument popisuje logický model. Konkrétní Prisma schema vznikne až v implementační fázi.

## School

Reprezentuje jednu školu jako organizaci.

| Pole | Typ | Poznámka |
| --- | --- | --- |
| id | UUID | interní ID |
| externalRegistryId | string? | stabilní ID z registru |
| name | string | oficiální název |
| schoolType | enum | PRIMARY / SECONDARY / PRIMARY_AND_SECONDARY / OTHER |
| region | string | pro MVP Praha |
| addressStreet | string? | |
| addressCity | string | |
| addressPostalCode | string? | |
| addressFull | string | exportní podoba |
| ico | string? | pokud je dostupné |
| redIzo | string? | pokud je dostupné |
| registryEmails | string[] | e-maily zveřejněné v registru; nejsou automaticky osobními kontakty |
| registryDirectorName | string? | jméno ředitele z registru; nespojuje se automaticky s registryEmails |
| registrySnapshotDate | datetime? | datum výstupu registru |
| registrySourceUrl | string? | přesný zdroj importu |
| website | string? | canonical URL |
| websiteStatus | enum | UNKNOWN / VERIFIED / INVALID |
| websiteVerifiedAt | datetime? | |
| createdAt | datetime | |
| updatedAt | datetime | |

## Contact

Konkrétní osoba a její zveřejněný pracovní kontakt.

| Pole | Typ | Poznámka |
| --- | --- | --- |
| id | UUID | |
| schoolId | FK | |
| firstName | string | povinné pro VERIFIED |
| lastName | string | povinné pro VERIFIED |
| email | string | původní podoba |
| normalizedEmail | string | lowercase + trim |
| role | string? | např. ředitelka, učitel, zástupce |
| qualityStatus | enum | VERIFIED / INCOMPLETE / STALE / REJECTED |
| collectedAt | datetime | první validní nalezení |
| lastVerifiedAt | datetime | poslední potvrzení |
| staleAt | datetime? | kdy přestal být potvrzován |
| createdAt | datetime | |
| updatedAt | datetime | |

### Unique constraint pro MVP

Doporučení:

```text
UNIQUE(schoolId, normalizedEmail)
```

E-mail se může vyskytovat ve více školách nebo může být později recyklován, proto nedává smysl považovat jej globálně za neměnnou identitu člověka.

## ContactSource

Doklad o tom, odkud konkrétní kontakt pochází.

| Pole | Typ | Poznámka |
| --- | --- | --- |
| id | UUID | |
| contactId | FK | |
| crawlRunId | FK | |
| sourceUrl | string | přesná veřejná URL |
| sourceType | enum | SCHOOL_WEBSITE / OPEN_DATA / REGISTRY |
| evidenceTextHash | string? | hash relevantního fragmentu |
| observedAt | datetime | |
| associationMethod | enum | DOM / STRUCTURED_DATA / AI |
| confidence | decimal/int | pomocná interní hodnota |

Neukládat zbytečně celý obsah webové stránky, pokud k auditu stačí URL, metadata a minimální důkazní fragment / hash.

## CrawlRun

| Pole | Typ |
| --- | --- |
| id | UUID |
| scope | JSON/string |
| startedAt | datetime |
| finishedAt | datetime? |
| status | enum |
| schoolsQueued | int |
| schoolsCompleted | int |
| pagesFetched | int |
| contactsFound | int |
| contactsVerified | int |
| errorCount | int |

## CrawlPage

Technické metadata navštívené stránky.

| Pole | Typ |
| --- | --- |
| id | UUID |
| crawlRunId | FK |
| schoolId | FK |
| url | string |
| canonicalUrl | string? |
| httpStatus | int? |
| fetchMode | STATIC / BROWSER |
| fetchedAt | datetime |
| contentHash | string? |
| relevanceScore | int/float? |
| errorCode | string? |

## Hlavní export

Export pro běžné použití má být záměrně jednoduchý:

```text
Jméno
Příjmení
E-mail
Škola
Adresa školy
Web
Datum sebrání
```

Volitelný rozšířený export může přidat:

```text
Funkce
Zdrojová URL
Datum poslední kontroly
Stav
```

## Definice Datum sebrání

`collectedAt` = datum, kdy systém daný konkrétní kontakt poprvé validně nalezl.

Při každém dalším potvrzení se **nemění**. Aktualizuje se pouze `lastVerifiedAt`.

To umožní odlišit stáří databázového záznamu od čerstvosti poslední kontroly.
