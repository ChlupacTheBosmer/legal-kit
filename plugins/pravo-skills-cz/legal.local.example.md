# legal.local.md — šablona firemního playbooku

> **Jak používat:** Tento soubor je vzor. Zkopírujte ho jako `legal.local.md` (bez `.example.`) do rootu vašeho projektu nebo pracovní složky, kde plugin běží. Plugin ho automaticky načte a použije při revizi smluv, triage NDA a generování právních odpovědí.
>
> Doplňte jen ty sekce, které pro vaši organizaci dávají smysl. Zbytek odstraňte nebo nechte prázdné — plugin pak v dané oblasti použije obecné tržní standardy.

---

## Standardní pozice ke klíčovým doložkám

### Limit odpovědnosti
- **Standardní pozice:** [např. 12 měsíčních poplatků nebo 2 mil. Kč, podle toho, co je nižší]
- **Vyjednatelný rozsah:** [např. 6–24 měsíců]
- **Eskalace seniorovi:** [např. < 6 měsíců nebo > 2 mil. Kč; chybějící cap; neomezená odpovědnost]
- **Vždy vyloučit z cap:** úmysl, hrubá nedbalost, porušení mlčenlivosti, IP infringement, GDPR breach

### Smluvní pokuta
- **Standardní pozice:** [např. max. 100 000 Kč za incident, ročně max. 500 000 Kč]
- **Eskalace:** [neomezená pokuta nebo > 1 mil. Kč za incident]

### Úrok z prodlení
- **Standardní pozice:** zákonná sazba podle nař. vlády č. 351/2013 Sb.
- **Eskalace:** > 0,05 % / den (cca 18 % p.a.)

### Doba trvání a ukončení
- **Standardní pozice:** [např. na dobu neurčitou, výpověď bez udání důvodu s 3měsíční výpovědní dobou]
- **Eskalace:** [např. > 6 měsíců výpovědní doby; bez možnosti ukončit bez udání důvodu]

### Promlčení nároků
- **Standardní pozice:** zákonné lhůty dle § 629 OZ (3 roky subjektivně, 10 let objektivně)
- **Eskalace:** smluvní zkrácení pod 24 měsíců

### Mlčenlivost (NDA)
- **Standardní pozice:** vzájemná, doba trvání 3 roky po skončení smlouvy
- **Eskalace:** jednostranná v náš neprospěch; > 5 let

### Smlouva o zpracování osobních údajů (DPA podle čl. 28 GDPR)
- **Standardní pozice:** vždy samostatná DPA, je-li protistrana zpracovatelem
- **Eskalace:** chybějící DPA, sub-zpracovatelé bez souhlasu, předání mimo EU bez SCC

### Rozhodné právo a řešení sporů
- **Standardní pozice:** [např. české právo, soudy v sídle naší společnosti]
- **Eskalace:** [např. cizí jurisdikce, povinné rozhodčí řízení mimo VRR ČR]

---

## Šablony právních odpovědí

### DSR (žádost subjektu údajů)

```
Vážený pane / paní [...],

děkujeme za vaši žádost ze dne [...] týkající se práv subjektu údajů podle [čl. 15–22 GDPR].

[Doplňte standardní text vaší organizace.]

S pozdravem,
[jméno, funkce]
```

### Litigation hold (oznámení uchování dokumentů)

```
Vážený / Vážená [...],

informujeme vás, že v souvislosti s [...] vznikla povinnost zachovat dokumenty a komunikaci pro účely případného řízení.

[Doplňte standardní text.]
```

### Žádost o podpis NDA (interní odpověď obchodu)

```
Ahoj [...],

NDA jsem prošel/prošla. [Klasifikace: ZELENÁ / ŽLUTÁ / ČERVENÁ]

[Doplňte standardní formulace.]
```

> Přidejte další šablony podle potřeby (vendor question, subpoena, insurance claim atd.). Plugin každou rozpozná podle názvu sekce.

---

## Eskalační triggery

Tyto situace **vždy** eskaluj seniornímu právníkovi nebo externímu advokátovi, bez ohledu na klasifikaci:

- Riziko sankce regulátora (ÚOOÚ, ČNB, ÚOHS) > [100 000 Kč]
- Trestní expozice společnosti podle zák. č. 418/2011 Sb. (TOPO)
- Spor o > [1 mil. Kč]
- Smlouva s veřejným zadavatelem (zák. č. 134/2016 Sb.)
- M&A transakce, fúze, akvizice
- Aktivní soudní řízení nebo jeho hrozba
- Datový incident s povinností oznámení podle čl. 33 GDPR
- Vyšetřování orgány činnými v trestním řízení

---

## Profil organizace (volitelné, pomáhá AI lépe rozhodovat)

- **Sektor:** [např. SaaS, finance, zdravotnictví, výroba, e-commerce]
- **Velikost:** [např. < 50 zaměstnanců / 50–500 / > 500]
- **Jurisdikce:** [např. pouze ČR / ČR + EU / globální]
- **Regulovaný subjekt:** [např. ne / ČNB / ÚOOÚ jako zpracovatel / jiné]
- **Apetit rizika:** [konzervativní / vyvážený / agresivní]
