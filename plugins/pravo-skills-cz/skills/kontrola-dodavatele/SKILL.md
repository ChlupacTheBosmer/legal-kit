---
name: kontrola-dodavatele
description: Zkontrolujte stav stávajících smluv s dodavatelem napříč všemi propojenými systémy — CLM, CRM, e-mail a úložiště dokumentů — včetně analýzy mezer a blížících se termínů. Použijte při zavádění nebo obnovení dodavatele, když potřebujete konsolidovaný přehled o tom, co je podepsáno a co chybí (rámcová smlouva, smlouva o zpracování osobních údajů, dílčí smlouva o dílo, smlouva o mlčenlivosti, SLA atd.), nebo při kontrole blížících se konců platnosti a přetrvávajících závazků.
argument-hint: "[název dodavatele]"
---

# /kontrola-dodavatele -- Stav smluv s dodavatelem

> Pokud narazíte na neznámé zástupné symboly nebo potřebujete zjistit, které nástroje jsou propojeny, viz [CONNECTORS.md](../../CONNECTORS.md).

Zkontrolujte stav stávajících smluv s dodavatelem napříč všemi propojenými systémy. Poskytuje konsolidovaný pohled na právní vztah.

**Důležité**: Tento příkaz pomáhá s právními workflow, ale neposkytuje právní poradenství ve smyslu zákona č. 85/1996 Sb. o advokacii. Hlášení o stavu smluv je třeba ověřit oproti originálním dokumentům kvalifikovaným advokátem.

## Jak používat (pro uživatele)

Vyvolej skill `/kontrola-dodavatele` a uveď název nebo IČO dodavatele. AI provede:

1. **Externí KYC dodavatele** přes `lex` — obchodní rejstřík (IČO, sídlo, statutární orgán, oprávněné osoby k podpisu), insolvenční rejstřík, účetní závěrky pro posouzení finančního zdraví, případnou veřejnou judikaturu k subjektu.
2. **Interní prohledání všech propojených systémů** — CLM (smlouvy), CRM (stav účtu), e-mail (vyjednávání), úložiště dokumentů (podepsané smlouvy), chat (relevantní diskuse).
3. **Konsolidovaný přehled smluv** — typ, stav, účinnost, konec platnosti, automatické prodloužení, klíčové podmínky.
4. **Analýza mezer** — co existuje a co chybí (např. máte rámcovou smlouvu, ale chybí smlouva o zpracování osobních údajů, přestože dodavatel zpracovává osobní údaje).
5. **Strukturované hlášení** — přehled vztahu, blížící se termíny, doporučené akce.

> ⚙ Sekce s technickými detaily (názvy nástrojů `lex`) jsou ve zbytku skillu označené poznámkou „Pro AI agenta". Při čtení skillu jako uživatel je můžete přeskočit.

## Krok 0 — ověřené právní zdroje (`lex`)

Primární právní zdroje jsou v tomto projektu dostupné přes MCP server **`lex`**, který čte přímo z úředních zdrojů (e-Sbírka, EUR-Lex, rozhodnuti.nsoud.cz, NALUS, rozhodnuti.justice.cz, ARES). `lex` se nepoužívá a připojovat se nemá.

**Postup:**

1. Stav konektoru neověřuj — `lex` je součástí projektu a je dostupný vždy.
2. Právní oporu vždy dohledej v `lex` a cituj jen znění, které jsi skutečně přečetl, včetně data účinnosti.
3. Stanoviska ÚOOÚ hledej v `lex` přes `cz_guidance_search` — nikoli ručně na webu. Co `lex` nepokrývá (judikatura NSS a vrchních soudů, stanoviska ČNB, ÚOHS, ČTÚ, SÚKL a NÚKIB), dohledej ručně a v závěru výslovně uveď, že tato část nebyla ověřena proti primárnímu zdroji.

> ⚙ **Pro AI agenta — nástroje `lex`:** `legal_cite` (ověřená citace + přesné znění; použij vždy před zápisem citace do dokumentu), `cz_act_text` / `cz_act_versions` / `cz_act_toc` / `cz_act_info` / `cz_act_relations` (české předpisy z e-Sbírky, ve znění k datu), `eu_celex_lookup` / `eu_act_text` / `eu_act_metadata` / `eu_act_versions` / `eu_act_search` (právo EU z EUR-Lex), `cz_case_search` + `cz_case_text` (judikatura NS), `cz_us_search` + `cz_us_keywords` (judikatura ÚS a její věcný rejstřík), `cz_case_lower_search` (okresní a krajské soudy — pozor, jen v naindexovaném období, které nástroj vypisuje) a `cz_case_lower_scan` (procházení podle data), `cz_guidance_search` + `cz_guidance_text` (**stanoviska ÚOOÚ** — pro otázky GDPR je prohledej vždy; jde o výklad dozorového úřadu, nikoli závazné právo), `cz_company_search` + `cz_company` (ARES a obchodní rejstřík — IČO, sídlo, statutární orgán, způsob jednání). Dotazy do českých zdrojů piš **česky**. Nástroje `mcp__mcp-registry__*` v Claude Code neexistují — nevolej je.


## Spuštění

```
/kontrola-dodavatele [název dodavatele]
```

Pokud není název dodavatele uveden, vyzvěte uživatele, aby upřesnil, kterého dodavatele chce zkontrolovat.

## Workflow

### Krok 1: Identifikujte dodavatele

Přijměte název dodavatele od uživatele. Ošetřete běžné varianty:
- Úplný obchodní název vs. obchodní značka (např. „Alphabet Inc." vs. „Google")
- Zkratky (např. „AWS" vs. „Amazon Web Services")
- Vztahy mezi mateřskou společností a dceřinou společností

Pokud je název dodavatele nejednoznačný, požádejte uživatele o upřesnění.

### Krok 2: Prohledejte propojené systémy

Vyhledejte dodavatele ve všech dostupných propojených systémech v pořadí dle priority:

#### CLM (systém pro správu smluv) -- Pokud je propojen
Vyhledejte všechny smlouvy s dodavatelem:
- Aktivní smlouvy
- Smlouvy, jejichž platnost skončila (za poslední 3 roky)
- Smlouvy v jednání nebo čekající na podpis
- Dodatky a přílohy

#### CRM -- Pokud je propojen
Vyhledejte záznam dodavatele/účtu:
- Stav účtu a typ vztahu
- Související příležitosti nebo obchodní případy
- Kontaktní údaje na právní/smluvní tým dodavatele

#### E-mail -- Pokud je propojen
Vyhledejte nedávnou relevantní korespondenci:
- E-maily týkající se smluv (za posledních 6 měsíců)
- Přílohy s návrhy smluv (smlouvy o mlčenlivosti, rámcové smlouvy, dílčí smlouvy)
- Vyjednávací vlákna

#### Dokumenty (např. Box, Egnyte, SharePoint) -- Pokud jsou propojeny
Vyhledejte:
- Podepsané smlouvy
- Redline úpravy a návrhy
- Podklady pro due diligence

#### Chat (např. Slack, Teams) -- Pokud je propojen
Vyhledejte nedávné zmínky:
- Žádosti o smlouvy týkající se tohoto dodavatele
- Právní dotazy k dodavateli
- Relevantní týmové diskuse (za poslední 3 měsíce)

#### `lex` — veřejné registry a due diligence

Pokud je v Kroku 0 potvrzeno použití `lex`, využij jej jako **primární zdroj** pro veřejné informace o dodavateli. Z výpisu z obchodního rejstříku a navazujících zdrojů ověř:

- **Identifikační údaje** — obchodní název, IČO, DIČ, právní forma, sídlo, datum vzniku, základní kapitál.
- **Statutární orgán a oprávněné osoby k podpisu** — kdo jedná za společnost a v jakém složení (samostatně × společně × s prokuristou).
- **Stav likvidace nebo insolvenčního řízení** — pokud probíhá, je smluvní vztah s dodavatelem sporný.
- **Účetní závěrky a výroční zprávy ze sbírky listin** — pro posouzení finančního zdraví dodavatele (relevantní u dlouhodobých smluv nebo velkých závazků).
- **Veřejná judikatura** — zda dodavatel figuruje v relevantních sporech (např. opakované žaloby na vady plnění, insolvenční řízení, spory s zákazníky).

Tyto informace zahrň do přehledu dodavatele a **označ červeně**, pokud zjistíš insolvenci, exekuci, likvidaci nebo významné rozsudky v neprospěch dodavatele.

**Pravidlo: maximálně tři rešerše na kontrolu dodavatele.** Pro každý druh zdroje (OR a sbírka listin, judikatura) můžeš v rámci jedné kontroly provést **nejvýše tři dotazy**.

> ⚙ **Pro AI agenta — nástroje `lex`:** `legal_cite` (ověřená citace + přesné znění; použij vždy před zápisem citace do dokumentu), `cz_act_text` / `cz_act_versions` / `cz_act_toc` / `cz_act_info` / `cz_act_relations` (české předpisy z e-Sbírky, ve znění k datu), `eu_celex_lookup` / `eu_act_text` / `eu_act_metadata` / `eu_act_versions` / `eu_act_search` (právo EU z EUR-Lex), `cz_case_search` + `cz_case_text` (judikatura NS), `cz_us_search` + `cz_us_keywords` (judikatura ÚS a její věcný rejstřík), `cz_case_lower_search` (okresní a krajské soudy — pozor, jen v naindexovaném období, které nástroj vypisuje) a `cz_case_lower_scan` (procházení podle data), `cz_guidance_search` + `cz_guidance_text` (**stanoviska ÚOOÚ** — pro otázky GDPR je prohledej vždy; jde o výklad dozorového úřadu, nikoli závazné právo), `cz_company_search` + `cz_company` (ARES a obchodní rejstřík — IČO, sídlo, statutární orgán, způsob jednání). Dotazy do českých zdrojů piš **česky**. Nástroje `mcp__mcp-registry__*` v Claude Code neexistují — nevolej je.

### Krok 3: Sestavte přehled o stavu smluv

Pro každou nalezenou smlouvu uveďte:

| Pole | Detaily |
|-------|---------|
| **Typ smlouvy** | smlouva o mlčenlivosti, rámcová smlouva, dílčí smlouva o dílo / objednávka, smlouva o zpracování osobních údajů (čl. 28 GDPR), SLA, licenční smlouva atd. |
| **Stav** | Aktivní, po platnosti, v jednání, čeká na podpis |
| **Datum účinnosti** | Kdy smlouva nabyla účinnosti |
| **Datum ukončení** | Kdy končí nebo se obnovuje |
| **Automatické prodloužení** | Ano/Ne, s dobou prodloužení a výpovědní lhůtou |
| **Klíčové podmínky** | Limit odpovědnosti, rozhodné právo, ustanovení o ukončení |
| **Dodatky** | Případné dodatky nebo přílohy v evidenci |

### Krok 4: Analýza mezer

Identifikujte, které smlouvy existují a které mohou chybět:

```
## Pokrytí smlouvami

[CHECK] Smlouva o mlčenlivosti -- [stav]
[CHECK/MISSING] Rámcová smlouva -- [stav nebo „Nenalezeno"]
[CHECK/MISSING] Smlouva o zpracování osobních údajů (čl. 28 GDPR) -- [stav nebo „Nenalezeno"]
[CHECK/MISSING] Dílčí smlouva o dílo / objednávka -- [stav nebo „Nenalezeno"]
[CHECK/MISSING] SLA -- [stav nebo „Nenalezeno"]
[CHECK/MISSING] Potvrzení o pojištění -- [stav nebo „Nenalezeno"]
```

Označte všechny mezery, které mohou být potřeba podle typu vztahu (např. pokud existuje rámcová smlouva, ale chybí smlouva o zpracování osobních údajů a dodavatel osobní údaje zpracovává).

### Krok 5: Vygenerujte hlášení

Vytvořte konsolidované hlášení:

```
## Stav smluv s dodavatelem: [Název dodavatele]

**Datum prověrky**: [dnešní datum]
**Prověřené zdroje**: [seznam prohledaných systémů]
**Nedostupné zdroje**: [seznam nepropojených systémů, pokud existují]

## Přehled vztahu

**Dodavatel**: [úplný obchodní název]
**Typ vztahu**: [dodavatel/partner/zákazník atd.]
**Stav v CRM**: [pokud je k dispozici]

## Přehled smluv

### [Typ smlouvy 1] -- [Stav]
- **Účinnost**: [datum]
- **Konec platnosti**: [datum] ([automaticky se prodlužuje / neprodlužuje se automaticky])
- **Klíčové podmínky**: [shrnutí podstatných ustanovení]
- **Umístění**: [kde je uložena podepsaná kopie]

### [Typ smlouvy 2] -- [Stav]
[atd.]

## Analýza mezer

[Co je zajištěno vs. co může být potřeba]

## Nadcházející úkony

- [Případné blížící se konce platnosti nebo termíny obnovení]
- [Požadované smlouvy, které ještě nejsou uzavřeny]
- [Dodatky nebo aktualizace, které mohou být potřeba]

## Poznámky

[Jakýkoli relevantní kontext z vyhledávání v e-mailu/chatu]
```

### Krok 6: Ošetření chybějících zdrojů

Pokud klíčové systémy nejsou propojeny přes MCP:

- **Žádný CLM**: Uveďte, že žádný CLM není propojen. Doporučte uživateli zkontrolovat CLM ručně. Nahlaste, co bylo nalezeno v ostatních systémech.
- **Žádný CRM**: Přeskočte kontext CRM. Upozorněte na chybějící údaje.
- **Žádný e-mail**: Uveďte, že e-mail nebyl prohledán. Doporučte uživateli prohledat e-mail na výrazy „[název dodavatele] smlouva" nebo „[název dodavatele] mlčenlivost".
- **Žádné dokumenty**: Uveďte, že úložiště dokumentů nebylo prohledáno.

Vždy jasně uveďte, které zdroje byly prověřeny a které nikoli, aby uživatel znal úplnost hlášení.

## Poznámky

- Pokud nejsou v žádném propojeném systému nalezeny žádné smlouvy, jasně to uveďte a zeptejte se uživatele, zda má smlouvy uloženy jinde
- U skupin dodavatelů (např. dodavatel s více dceřinými společnostmi) se zeptejte, zda si uživatel přeje prověřit konkrétní subjekt, nebo celou skupinu
- Upozorněte na všechny smlouvy, kterým skončila platnost, ale mohou stále obsahovat přetrvávající závazky (mlčenlivost, odškodnění atd.)
- Pokud se smlouva blíží ke konci platnosti (do 90 dnů), výrazně na to upozorněte
