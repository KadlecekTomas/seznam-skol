# Pravidla kvality

Cílem není získat co nejvíc řádků. Cílem je získat co nejvíc **použitelných a auditovatelných kontaktů**.

## 1. Definice VERIFIED kontaktu

Kontakt může mít stav `VERIFIED` pouze pokud současně platí:

- existuje jméno,
- existuje příjmení,
- existuje konkrétní e-mail,
- kontakt je jednoznačně přiřazen ke škole,
- škola má adresu,
- škola má ověřený web,
- existuje veřejná zdrojová URL,
- e-mail byl na zdroji explicitně zveřejněn,
- vazba osoba ↔ e-mail je dostatečně jednoznačná.

Pokud některá z těchto podmínek není splněna, kontakt nesmí být v hlavním exportu.

---

## 2. Zakázané odvozování

Nesmíme vytvořit e-mail pouze na základě:

- jména a příjmení,
- známého e-mailového vzoru školy,
- e-mailu jiné osoby,
- domény školy,
- výsledku generovaného AI.

Příklad:

```text
Mgr. Jan Novák
škola používá tvar prijmeni@skola.cz
```

Výsledek:

```text
novak@skola.cz  ← NESMÍ vzniknout
```

---

## 3. Obecné e-maily

Adresy typu:

```text
info@
sekretariat@
reditelna@
kancelar@
skola@
office@
```

mohou být uloženy jako organizační kontakty školy, ale nesmí být vydávány za konkrétní osobu.

Pokud stránka explicitně říká:

```text
Jan Novák, ředitel
reditel@skola.cz
```

může být vazba evidována jako explicitní pracovní kontakt konkrétní osoby, protože ji zveřejnil samotný zdroj. Původ adresy musí být dohledatelný.

---

## 4. Quality status

### VERIFIED

Splňuje všechny požadavky hlavního exportu.

### INCOMPLETE

Například:

- osoba bez e-mailu,
- e-mail bez jednoznačně určené osoby,
- chybějící web,
- nedostatečně potvrzená vazba.

### STALE

Kontakt byl dříve VERIFIED, ale při následných kontrolách už jej zdroj nepotvrzuje.

Stav STALE nesmí automaticky znamenat smazání.

### REJECTED

Záznam je známý jako chybný, například:

- parser spojil dvě různé osoby,
- e-mail patří jiné organizaci bez vysvětlení,
- zdroj je agregátor bez dostatečné důvěry,
- záznam vznikl odhadem.

---

## 5. Confidence

Confidence je pomocná technická metrika. Nemůže sama změnit nevalidní kontakt na VERIFIED.

Doporučené signály:

### Silné
- jméno a e-mail jsou ve stejném DOM bloku,
- strukturovaná tabulka se sloupci jméno/e-mail,
- kontakt je přímo na oficiálním webu školy,
- stejná kombinace je potvrzena více veřejnými zdroji.

### Slabé
- jméno a e-mail jsou pouze blízko v textu,
- stránka má nekonzistentní HTML,
- AI musela řešit více možných osob.

---

## 6. E-mailová validace

MVP validuje minimálně:

- trim,
- lowercase normalizaci,
- syntaxi,
- zakázané placeholder hodnoty,
- duplicitní adresy,
- základní vztah domény ke škole nebo explicitní důkaz na oficiálním webu.

SMTP probing není podmínkou MVP a nemá se používat jako náhrada explicitního zdroje.

---

## 7. Deduplikace

Primární deduplikace v rámci školy:

```text
schoolId + normalizedEmail
```

Při nalezení stejného kontaktu na více URL:

- Contact zůstává jeden,
- ContactSource může být více.

Při změně role se zachová aktuální hodnota a historie pozorování.

---

## 8. Metriky pilotu

Pilot na 20–30 školách musí měřit minimálně:

- počet škol s ověřeným webem,
- počet crawlovaných relevantních stránek,
- počet nalezených e-mailů,
- počet VERIFIED osobních kontaktů,
- VERIFIED kontaktů / škola,
- podíl false positives z ručního QA vzorku,
- podíl škol bez jediného VERIFIED kontaktu,
- kolik případů potřebovalo browser fallback,
- kolik případů potřebovalo AI fallback.

### Go/No-Go princip

Pokud získáváme velké množství řádků, ale neumíme bezpečně prokázat vazbu osoba ↔ e-mail, pilot není úspěšný.

Kvalita má přednost před objemem.
