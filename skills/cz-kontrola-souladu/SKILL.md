---
name: kontrola-souladu
description: Proveďte kontrolu souladu s předpisy u navrhované akce, produktové funkce nebo obchodní iniciativy; identifikujte aplikovatelné regulace, požadovaná schválení a rizikové oblasti. Použijte při spouštění funkce pracující s osobními údaji, když marketing nebo produkt navrhuje něco s regulatorními dopady, nebo když potřebujete před zahájením zjistit, jaká schválení a jurisdikční požadavky se uplatní.
argument-hint: "<akce nebo iniciativa ke kontrole>"
---

# /kontrola-souladu -- Kontrola souladu s předpisy

> Pokud narazíte na neznámé zástupné symboly nebo potřebujete ověřit, které nástroje jsou připojeny, podívejte se do [CONNECTORS.md](../../CONNECTORS.md).

Proveďte kontrolu souladu u navrhované akce, produktové funkce, marketingové kampaně nebo obchodní iniciativy.

**Důležité**: Tento příkaz pomáhá s právními workflow, ale neposkytuje právní poradenství ve smyslu zákona č. 85/1996 Sb. o advokacii. Posouzení souladu by měl provést kvalifikovaný advokát. Regulatorní požadavky se často mění; aktuální požadavky vždy ověřte u autoritativních zdrojů.

## Jak používat (pro uživatele)

Vyvolej skill `/kontrola-souladu` a popiš plánovanou akci (např. spuštění refferal programu, biometrická autentizace v mobilní aplikaci, přenos dat mimo EU, nová marketingová kampaň). AI provede:

1. **Identifikaci aplikovatelných regulací a interních předpisů** přes `lex` (GDPR, zák. 110/2019 Sb., NIS2, DORA, AI Act, AML, sektorové předpisy).
2. **Ověření aktuálních stanovisek regulátorů** (ÚOOÚ, ČNB, ÚOHS, ČTÚ, SÚKL atd.) — co je v jejich aktuálních prioritách.
3. **Kontrolu precedentu** v české judikatuře k obdobným compliance situacím a sankčním řízením.
4. **Klasifikaci rizik a požadovaných schválení** — DPIA, registr činností zpracování, oznamovací povinnosti, předchozí souhlasy regulátora.
5. **Strukturovaný výstup** — doporučení (Pokračovat / Pokračovat za podmínek / Vyžaduje další přezkum), tabulka regulací, akční položky s vlastníky a termíny.

> ⚙ Sekce s technickými detaily (názvy nástrojů `lex`) jsou ve zbytku skillu označené poznámkou „Pro AI agenta". Při čtení skillu jako uživatel je můžete přeskočit.

## Krok 0 — ověřené právní zdroje (`lex`)

Primární právní zdroje jsou v tomto projektu dostupné přes MCP server **`lex`**, který čte přímo z úředních zdrojů (e-Sbírka, EUR-Lex, rozhodnuti.nsoud.cz, NALUS, rozhodnuti.justice.cz, ARES). `lex` se nepoužívá a připojovat se nemá.

**Postup:**

1. Stav konektoru neověřuj — `lex` je součástí projektu a je dostupný vždy.
2. Právní oporu vždy dohledej v `lex` a cituj jen znění, které jsi skutečně přečetl, včetně data účinnosti.
3. Stanoviska ÚOOÚ hledej v `lex` přes `cz_guidance_search` — nikoli ručně na webu. Co `lex` nepokrývá (judikatura NSS a vrchních soudů, stanoviska ČNB, ÚOHS, ČTÚ, SÚKL a NÚKIB), dohledej ručně a v závěru výslovně uveď, že tato část nebyla ověřena proti primárnímu zdroji.

> ⚙ **Pro AI agenta — nástroje `lex`:** `legal_cite` (ověřená citace + přesné znění; použij vždy před zápisem citace do dokumentu), `cz_act_text` / `cz_act_versions` / `cz_act_toc` / `cz_act_info` / `cz_act_relations` (české předpisy z e-Sbírky, ve znění k datu), `eu_celex_lookup` / `eu_act_text` / `eu_act_metadata` / `eu_act_versions` / `eu_act_search` (právo EU z EUR-Lex), `cz_case_search` + `cz_case_text` (judikatura NS), `cz_us_search` + `cz_us_keywords` (judikatura ÚS a její věcný rejstřík), `cz_case_lower_search` (okresní a krajské soudy — pozor, jen v naindexovaném období, které nástroj vypisuje) a `cz_case_lower_scan` (procházení podle data), `cz_guidance_search` + `cz_guidance_text` (**stanoviska ÚOOÚ** — pro otázky GDPR je prohledej vždy; jde o výklad dozorového úřadu, nikoli závazné právo), `cz_company_search` + `cz_company` (ARES a obchodní rejstřík — IČO, sídlo, statutární orgán, způsob jednání). Dotazy do českých zdrojů piš **česky**. Nástroje `mcp__mcp-registry__*` v Claude Code neexistují — nevolej je.


## Použití

```
/kontrola-souladu $ARGUMENTS
```

## Co od uživatele potřebuji

Popis plánované akce. Příklady:

- „Chceme spustit doporučující (referral) program s peněžními odměnami."
- „Do mobilní aplikace přidáváme biometrickou autentizaci."
- „Potřebujeme zpracovávat data zákazníků z EU v datovém centru mimo EU."
- „Marketing chce v reklamách používat doporučení zákazníků."

## Jak skill určuje, co kontrolovat

Skill kombinuje tři zdroje:

1. **Z popisu plánované akce od uživatele.** AI analyzuje, čeho se akce týká (osobní údaje, finance, AI komponenta, marketing zákazníkům, přenos dat, biometrie, regulovaný sektor atd.), a podle toho identifikuje, které části baseline katalogu níže jsou relevantní.
2. **Z minimálního baseline katalogu** — strukturovaný seznam regulací, proti kterým skill **vždy projde** plánovanou akci a posoudí relevanci pro daný případ.
3. **Z `lex` rešerše** — pro doplnění regulací mimo baseline (např. nová EU regulace, sektorový předpis konkrétního ministerstva, podzákonný akt). Baseline je minimum, ne strop.

**Skill je primárně přizpůsobený českému a evropskému právu** (ČR + EU regulace s přímou účinností nebo českou implementací). Pro jiné jurisdikce dej uživateli vědět, že potřebuje konzultaci s místním právníkem.

## Minimální baseline regulací k ověření

Toto je standardní katalog, proti kterému skill prochází každou plánovanou akci. **Vždy projdi celý seznam** a u každé položky výslovně posuď, zda je pro plánovanou akci relevantní (např. *„GDPR — relevantní, akce zpracovává osobní údaje zákazníků"* vs. *„MiCA — irelevantní, akce není o kryptoaktivech"*). Položky, které nejsou relevantní, v reportu krátce zmiň jako vyloučené.

### A) Průřezové regulace (vždy zvážit u jakékoli akce)

- **GDPR** (nař. (EU) 2016/679) + **zák. č. 110/2019 Sb.** o zpracování osobních údajů
- **zák. č. 418/2011 Sb.** o trestní odpovědnosti právnických osob (TOPO)
- **AML zák. č. 253/2008 Sb.** o některých opatřeních proti legalizaci výnosů z trestné činnosti
- **zákoník práce 262/2006 Sb.** (pokud se akce dotýká zaměstnanců)

### B) Kybernetická bezpečnost, AI a digitální regulace

- **NIS2 / zák. č. 264/2025 Sb.** o kybernetické bezpečnosti
- **zák. č. 181/2014 Sb.** o kybernetické bezpečnosti (do účinnosti NIS2 implementace)
- **AI Act** (nař. (EU) 2024/1689)
- **Cyber Resilience Act** (nař. (EU) 2024/2847)
- **Digital Services Act** (nař. (EU) 2022/2065)
- **Data Act** (nař. (EU) 2023/2854)
- **eIDAS 2 / EUDI Wallet** (nař. (EU) 910/2014 ve znění novely)

### C) Finanční regulace

- **DORA** (nař. (EU) 2022/2554)
- **MiCA** (nař. (EU) 2023/1114)
- **ČNB** — rozhodnutí, stanoviska a metodické pokyny

### D) Hospodářská soutěž a tržní pravidla

- **zák. č. 143/2001 Sb.** o ochraně hospodářské soutěže
- **zák. č. 634/1992 Sb.** o ochraně spotřebitele
- **zák. č. 40/1995 Sb.** o regulaci reklamy
- **zák. č. 480/2004 Sb.** o některých službách informační společnosti (e-commerce)

### E) Sektorové regulace (relevantní podle oboru)

- **Energetika:** ERÚ, **zák. č. 458/2000 Sb.** (energetický zákon)
- **Telekomunikace:** ČTÚ, **zák. č. 127/2005 Sb.** o elektronických komunikacích
- **Zdravotnictví a léčiva:** SÚKL, **zák. č. 378/2007 Sb.** o léčivech
- **Hazardní hry:** MF, **zák. č. 186/2016 Sb.** o hazardních hrách
- **Zemědělství a veterinární:** MZe, SVS, **zák. č. 166/1999 Sb.** o veterinární péči
- **Životní prostředí:** ČIŽP, MŽP, **zák. č. 17/1992 Sb.** o životním prostředí, **zák. č. 76/2002 Sb.** (IPPC)
- **Doprava:** Ministerstvo dopravy, drážní úřad, **zák. č. 56/2001 Sb.** a sektorové předpisy
- **Stavebnictví:** **zák. č. 283/2021 Sb.** (nový stavební zákon)

### F) Daňové předpisy (přesahy z compliance)

- **daňový řád** zák. č. 280/2009 Sb.
- **zák. č. 235/2004 Sb.** o DPH
- **zák. č. 586/1992 Sb.** o daních z příjmů

## Otevřeno pro `lex` — další návrhy regulací

Pokud `search_regulatory_parallel` nebo `search_law_parallel` najde **další regulace mimo tento baseline** (např. nová EU regulace přijatá po sestavení baseline, sektorový předpis pro niche oblast, podzákonný předpis konkrétního ministerstva, aktuální stanovisko regulátora), **přidej je do analýzy** a v reportu výslovně zmiň s odkazem na zdroj. **Baseline je minimum, ne strop** — `lex` rešerše má doplnit, co katalog nepokrývá.

Pokud je akce v **niche regulovaném sektoru** (jaderná energetika, kosmické technologie, biotechnologie, fintech vyžadující licenci ČNB, ozbrojený průmysl atd.), upozorni uživatele v závěru, že některé sektor-specifické regulace nemusejí být v `lex` plně indexované, a doporuč **konzultaci se specializovaným advokátem** (sektor + jurisdikce).

## Identifikace regulatorního rámce přes `lex`

Pokud je v Kroku 0 potvrzeno použití `lex`, využij jej jako **primární zdroj** pro identifikaci aplikovatelných regulací a aktuálního stanoviska regulátorů. Bez něj hrozí, že přehlédneš nedávnou novelu nebo aktuální enforcement prioritu.

**Co `lex` dodá do kontroly souladu:**

- **Stanoviska a metodické pokyny regulátorů** — aktuální výklad regulátorů (ÚOOÚ, ČNB, ÚOHS, ČTÚ, SÚKL, NÚKIB, ERÚ, MF, MZe, MŽP a další). Aktuální enforcement priority.
- **Aktuální znění zákonů** — včetně novel a podzákonných předpisů. Verzionované — `lex` najde verzi platnou ke dni dotazu.
- **Judikatura** — soudní rozhodnutí k obdobným compliance situacím a sankčním řízením.
- **Plný text klíčových ustanovení nebo rozhodnutí** pro přesnou citaci ve výstupu.

> **Co `lex` indexuje a co ne:** `lex` vyhledává pouze v dokumentech, které má ve své databázi indexované. Aktuální seznam zdrojů a pokrytí je dostupný na **<https://www.directcase.ai/>**. Pokud výsledek rešerše nenajde žádný relevantní zdroj, nemusí to znamenat, že předpis neexistuje — `lex` ho jen nemusí mít indexovaný. V takovém případě uživatele odkaž na ASPI, Beck-online, web regulátora nebo sektorového advokáta.

**Pravidlo: maximálně tři rešerše na kontrolu souladu.** Pro každý druh zdroje (regulatorika, zákony, judikatura) můžeš v rámci jedné kontroly provést **nejvýše tři dotazy**. Formuluj komplexní dotaz pokrývající všechny aplikovatelné regulace najednou.

> ⚙ **Pro AI agenta — nástroje `lex`:** `legal_cite` (ověřená citace + přesné znění; použij vždy před zápisem citace do dokumentu), `cz_act_text` / `cz_act_versions` / `cz_act_toc` / `cz_act_info` / `cz_act_relations` (české předpisy z e-Sbírky, ve znění k datu), `eu_celex_lookup` / `eu_act_text` / `eu_act_metadata` / `eu_act_versions` / `eu_act_search` (právo EU z EUR-Lex), `cz_case_search` + `cz_case_text` (judikatura NS), `cz_us_search` + `cz_us_keywords` (judikatura ÚS a její věcný rejstřík), `cz_case_lower_search` (okresní a krajské soudy — pozor, jen v naindexovaném období, které nástroj vypisuje) a `cz_case_lower_scan` (procházení podle data), `cz_guidance_search` + `cz_guidance_text` (**stanoviska ÚOOÚ** — pro otázky GDPR je prohledej vždy; jde o výklad dozorového úřadu, nikoli závazné právo), `cz_company_search` + `cz_company` (ARES a obchodní rejstřík — IČO, sídlo, statutární orgán, způsob jednání). Dotazy do českých zdrojů piš **česky**. Nástroje `mcp__mcp-registry__*` v Claude Code neexistují — nevolej je.

## Výstup

```markdown
## Kontrola souladu: [Iniciativa]

### Shrnutí
[Stručné posouzení: Pokračovat / Pokračovat za podmínek / Vyžaduje další přezkum]

### Aplikovatelné regulace a interní předpisy
| Regulace/Předpis | Relevance | Klíčové požadavky |
|-------------------|-----------|-----------------|
| [GDPR / zák. č. 110/2019 Sb. / NIS2 / AI Act / CCPA apod.] | [Jak se uplatní] | [Co je třeba udělat] |

### Požadavky
| # | Požadavek | Stav | Potřebný krok |
|---|-------------|--------|---------------|
| 1 | [Požadavek] | [Splněno / Nesplněno / Neznámé] | [Co udělat] |

### Rizikové oblasti
| Riziko | Závažnost | Zmírnění |
|------|----------|------------|
| [Riziko] | [Vysoké/Střední/Nízké] | [Jak řešit] |

### Doporučené kroky
1. [Nejdůležitější krok]
2. [Druhá priorita]
3. [Třetí priorita]

### Potřebná schválení
| Schvalovatel | Proč | Stav |
|----------|-----|--------|
| [Osoba/Tým] | [Důvod] | [Čeká] |

### Doporučený další přezkum
[Oblasti, u nichž se doporučuje konzultace s externím advokátem nebo specialistou]
```

## Přehled regulací ochrany osobních údajů

### GDPR (Obecné nařízení o ochraně osobních údajů)

**Rozsah**: Vztahuje se na zpracování osobních údajů osob nacházejících se v EU/EHP, bez ohledu na to, kde se zpracovatelská organizace nachází. V České republice doplněno zákonem č. 110/2019 Sb., o zpracování osobních údajů.

**Klíčové povinnosti pro interní právní oddělení**:
- **Právní titul**: Identifikujte a zdokumentujte právní titul pro každou zpracovatelskou činnost (souhlas, smlouva, oprávněný zájem, právní povinnost, životně důležitý zájem, veřejný úkol)
- **Práva subjektu údajů**: Reagujte na žádosti o přístup, opravu, výmaz, přenositelnost, omezení a námitku do 30 dnů (u složitých žádostí lze prodloužit o 60 dnů)
- **Posouzení vlivu na ochranu osobních údajů (DPIA)**: Vyžadováno pro zpracování, které pravděpodobně povede k vysokému riziku pro fyzické osoby
- **Oznámení o porušení zabezpečení**: Oznámení dozorovému úřadu (v ČR Úřad pro ochranu osobních údajů) do 72 hodin od zjištění porušení zabezpečení osobních údajů; při vysokém riziku oznámení dotčeným osobám bez zbytečného odkladu
- **Záznamy o činnostech zpracování**: Vedení záznamů podle čl. 30 GDPR
- **Mezinárodní předání**: Zajištění vhodných záruk pro předání mimo EHP (SCC, rozhodnutí o odpovídající ochraně, BCR)
- **Povinnost jmenovat DPO**: Jmenujte pověřence pro ochranu osobních údajů (DPO), pokud to vyžaduje zákon (orgán veřejné moci, rozsáhlé zpracování zvláštních kategorií, rozsáhlé systematické monitorování)

**Časté kontaktní body interního právního oddělení**:
- Posouzení smluv o zpracování (DPA) s dodavateli z pohledu souladu s GDPR
- Poradenství produktovým týmům ohledně principu privacy by design
- Reakce na dotazy dozorového úřadu
- Řízení mechanismů přeshraničního předávání údajů
- Posouzení mechanismů souhlasu a informačních memorand o ochraně osobních údajů

### CCPA / CPRA (California Consumer Privacy Act / California Privacy Rights Act)

**Rozsah**: Vztahuje se na podniky, které shromažďují osobní údaje obyvatel Kalifornie a dosahují stanovených prahů v oblasti příjmů, objemu dat nebo prodeje dat. (Jde o legislativu amerického státu Kalifornie; pokud působíte v EU, primárním rámcem pro vás bude GDPR.)

**Klíčové povinnosti**:
- **Právo vědět**: Spotřebitelé mohou požádat o zpřístupnění osobních údajů, které jsou shromažďovány, používány a sdíleny
- **Právo na výmaz**: Spotřebitelé mohou požádat o výmaz svých osobních údajů
- **Právo odmítnout (opt-out)**: Spotřebitelé mohou odmítnout prodej nebo sdílení osobních údajů
- **Právo na opravu**: Spotřebitelé mohou požádat o opravu nepřesných osobních údajů (rozšíření podle CPRA)
- **Právo omezit využívání citlivých osobních údajů**: Spotřebitelé mohou omezit využívání citlivých OÚ na konkrétní účely (rozšíření podle CPRA)
- **Zákaz diskriminace**: Spotřebitele uplatňující svá práva nelze diskriminovat
- **Informační memorandum**: Při sběru nebo před ním je nutné poskytnout informační memorandum popisující kategorie shromažďovaných OÚ a účely
- **Smlouvy s poskytovateli služeb**: Smlouvy s poskytovateli služeb musí omezit použití OÚ na stanovený obchodní účel

**Lhůty pro odpověď**:
- Potvrzení přijetí do 10 pracovních dnů
- Věcná odpověď do 45 kalendářních dnů (s upozorněním lze prodloužit o dalších 45 dnů)

### Další klíčové regulace, které stojí za sledování

| Regulace | Jurisdikce | Klíčové odlišnosti |
|---|---|---|
| **Zák. č. 110/2019 Sb.** | Česká republika | Adaptační zákon ke GDPR; dozor vykonává Úřad pro ochranu osobních údajů (ÚOOÚ) |
| **NIS2** (směrnice EU 2022/2555) | EU | Povinnosti v oblasti kybernetické bezpečnosti pro klíčové a významné subjekty; v ČR transponováno do zákona o kybernetické bezpečnosti (č. 181/2014 Sb., ve znění novely) |
| **DORA** (nařízení EU 2022/2554) | EU | Digitální provozní odolnost finančního sektoru; dohled vykonává ČNB |
| **AI Act** (nařízení EU 2024/1689) | EU | Harmonizovaná pravidla pro umělou inteligenci; rizikově založený přístup |
| **Digital Services Act (DSA)** | EU | Povinnosti poskytovatelů online služeb a platforem |
| **UK GDPR** | Spojené království | Post-brexitová verze britského GDPR; dozor ICO; obdobné EU GDPR se specifiky UK |
| **LGPD** (Brazílie) | Brazílie | Podobné GDPR; vyžaduje jmenování DPO; dozor Národního úřadu pro ochranu údajů (ANPD) |
| **PIPL** (Čína) | Čína | Přísná pravidla přeshraničního předávání; požadavky na lokalizaci dat; dozor CAC |

## Kontrolní seznam pro posouzení DPA

Při posuzování smlouvy o zpracování osobních údajů (DPA) ověřte následující:

### Povinné náležitosti (čl. 28 GDPR)

- [ ] **Předmět a doba trvání**: Jasně vymezený rozsah a doba zpracování
- [ ] **Povaha a účel**: Konkrétní popis toho, co se bude zpracovávat a proč
- [ ] **Typ osobních údajů**: Kategorie zpracovávaných osobních údajů
- [ ] **Kategorie subjektů údajů**: Čí osobní údaje jsou zpracovávány
- [ ] **Povinnosti a práva správce**: Pokyny správce a jeho dohledová práva

### Povinnosti zpracovatele

- [ ] **Zpracovává pouze na základě doložených pokynů**: Zpracovatel se zavazuje zpracovávat pouze podle pokynů správce (s výjimkou zákonných požadavků)
- [ ] **Mlčenlivost**: Pracovníci oprávnění ke zpracování jsou zavázáni mlčenlivostí
- [ ] **Bezpečnostní opatření**: Popsána vhodná technická a organizační opatření (odkaz na čl. 32)
- [ ] **Požadavky na subzpracovatele**:
  - [ ] Požadavek písemného souhlasu (obecného nebo konkrétního)
  - [ ] Při obecném souhlasu: oznámení změn s možností vznést námitku
  - [ ] Subzpracovatelé vázáni stejnými povinnostmi prostřednictvím písemné smlouvy
  - [ ] Zpracovatel zůstává odpovědný za činnost subzpracovatelů
- [ ] **Součinnost při žádostech subjektů údajů**: Zpracovatel bude spolupracovat při reakcích na žádosti subjektů údajů
- [ ] **Součinnost při bezpečnosti a porušení**: Zpracovatel bude poskytovat součinnost při plnění bezpečnostních povinností, oznámeních o porušení, DPIA a konzultacích
- [ ] **Výmaz nebo vrácení**: Po ukončení smlouvy výmaz nebo vrácení všech osobních údajů (dle volby správce) a výmaz existujících kopií, pokud zákon nestanoví povinnost uchování
- [ ] **Právo auditu**: Správce má právo provádět audity a kontroly (nebo akceptovat auditní zprávy třetích stran)
- [ ] **Oznámení o porušení**: Zpracovatel oznámí správci porušení zabezpečení osobních údajů bez zbytečného odkladu (ideálně do 24-48 hodin; musí umožnit správci dodržet regulatorní 72hodinovou lhůtu)

### Mezinárodní předání

- [ ] **Identifikován mechanismus předání**: SCC, rozhodnutí o odpovídající ochraně, BCR nebo jiný platný mechanismus
- [ ] **Verze SCC**: Používá se aktuální verze SCC EU (z června 2021), pokud je to relevantní
- [ ] **Správný modul**: Zvolen odpovídající modul SCC (C2P, C2C, P2P, P2C)
- [ ] **Posouzení dopadu předání (TIA)**: Dokončeno při předávání do zemí bez rozhodnutí o odpovídající ochraně
- [ ] **Doplňková opatření**: Technická, organizační nebo smluvní opatření k překlenutí mezer identifikovaných v TIA
- [ ] **Dodatek pro UK**: Pokud se týká osobních údajů z UK, zahrnut UK International Data Transfer Addendum

### Praktické úvahy

- [ ] **Odpovědnost**: Ustanovení o odpovědnosti v DPA jsou v souladu s hlavní smlouvou o službách (nebo s ní nekolidují)
- [ ] **Sladění ukončení**: Doba platnosti DPA odpovídá smlouvě o službách
- [ ] **Místa zpracování**: Místa zpracování jsou specifikována a akceptovatelná
- [ ] **Bezpečnostní standardy**: Vyžadovány konkrétní bezpečnostní standardy nebo certifikace (SOC 2, ISO 27001 apod.)
- [ ] **Pojištění**: Odpovídající pojistné krytí pro činnosti zpracování údajů

### Časté problémy v DPA

| Problém | Riziko | Standardní pozice |
|---|---|---|
| Paušální souhlas se subzpracovateli bez oznamovací povinnosti | Ztráta kontroly nad řetězcem zpracování | Vyžadovat oznámení s právem vznést námitku |
| Lhůta oznámení porušení > 72 hodin | Může zabránit včasnému regulatornímu oznámení | Vyžadovat oznámení do 24-48 hodin |
| Žádná audit. práva (nebo jen prostřednictvím zpráv třetích stran) | Nelze ověřit soulad | Akceptovat SOC 2 Type II + právo auditu při důvodném podezření |
| Lhůta pro výmaz dat není stanovena | Data jsou uchovávána neomezeně | Vyžadovat výmaz do 30-90 dnů od ukončení |
| Nestanovena místa zpracování údajů | Data mohou být zpracovávána kdekoli | Vyžadovat zveřejnění míst zpracování |
| Zastaralé SCC | Neplatný mechanismus předání | Vyžadovat aktuální EU SCC (verze 2021) |

## Vyřizování žádostí subjektů údajů

### Přijetí žádosti

Když obdržíte žádost subjektu údajů:

1. **Určete typ žádosti**:
   - Přístup (kopie osobních údajů)
   - Oprava (oprava nepřesných údajů)
   - Výmaz / smazání („právo být zapomenut")
   - Omezení zpracování
   - Přenositelnost údajů (strukturovaný, strojově čitelný formát)
   - Námitka proti zpracování
   - Odmítnutí prodeje/sdílení (CCPA/CPRA)
   - Omezení využití citlivých osobních údajů (CPRA)

2. **Určete aplikovatelné regulace**:
   - Kde se subjekt údajů nachází?
   - Jaké zákony se uplatní podle přítomnosti a činností vaší organizace?
   - Jaké jsou konkrétní požadavky a lhůty?

3. **Ověřte totožnost**:
   - Potvrďte, že žadatel je tím, za koho se vydává
   - Použijte přiměřené ověřovací postupy úměrné citlivosti údajů
   - Nepožadujte nadměrnou dokumentaci

4. **Zaznamenejte žádost**:
   - Datum přijetí
   - Typ žádosti
   - Totožnost žadatele
   - Aplikovatelná regulace
   - Lhůta pro odpověď
   - Přidělený zpracovatel

### Lhůty pro odpověď

| Regulace | Počáteční potvrzení | Věcná odpověď | Prodloužení |
|---|---|---|---|
| GDPR | Není stanoveno (best practice: neprodleně) | 30 dnů | +60 dnů (s upozorněním) |
| CCPA/CPRA | 10 pracovních dnů | 45 kalendářních dnů | +45 dnů (s upozorněním) |
| UK GDPR | Není stanoveno (best practice: neprodleně) | 30 dnů | +60 dnů (s upozorněním) |
| LGPD | Nestanoveno | 15 dnů | Omezená možnost prodloužení |

### Výjimky a omezení

Před vyhověním žádosti zkontrolujte, zda se uplatní nějaké výjimky:

**Časté výjimky napříč regulacemi**:
- Obhajoba nebo uplatnění právních nároků
- Právní povinnosti vyžadující uchování
- Veřejný zájem nebo výkon veřejné moci
- Svoboda projevu a informací (u žádostí o výmaz)
- Archivace ve veřejném zájmu nebo pro vědecký/historický výzkum

**Organizačně specifické úvahy**:
- *„Litigation hold"* (zajištění dokumentů pro účely sporu): údaje podléhající této povinnosti nelze smazat. V ČR nejde o samostatný formální institut jako v US Federal Rules of Civil Procedure — vychází z obecné povinnosti zachovat důkazy v hrozícím nebo probíhajícím řízení a edicní povinnosti dle § 78a OSŘ.
- Regulatorní uchování: Finanční záznamy, personální záznamy a další kategorie mohou mít povinné doby uchování (např. dle zákona o účetnictví č. 563/1991 Sb., zákoníku práce č. 262/2006 Sb.)
- Práva třetích stran: Vyhovění žádosti by mohlo nepříznivě ovlivnit práva jiných osob

### Postup odpovědi

1. Shromážděte všechny osobní údaje žadatele napříč systémy
2. Uplatněte případné výjimky a zdokumentujte jejich základ
3. Připravte odpověď: vyhovte žádosti nebo vysvětlete, proč jí (zcela nebo částečně) nelze vyhovět
4. V případě zamítnutí (zcela nebo částečně): uveďte konkrétní právní základ zamítnutí
5. Poučte žadatele o právu podat stížnost u dozorového úřadu (v ČR ÚOOÚ)
6. Zdokumentujte odpověď a uchovávejte záznamy o žádosti a odpovědi

## Základy monitoringu regulatorních změn

### Co sledovat

Udržujte přehled o vývoji v těchto oblastech:
- **Regulatorní vodítka**: Nová nebo aktualizovaná vodítka dozorových úřadů (ÚOOÚ, EDPB, ICO, CNIL apod.)
- **Rozhodnutí o sankcích**: Pokuty, opatření a urovnání, která signalizují priority regulátorů
- **Legislativní změny**: Nové zákony o ochraně osobních údajů, novely stávajících zákonů, prováděcí předpisy
- **Průmyslové standardy**: Aktualizace ISO 27001, SOC 2, NIST frameworks a oborové požadavky
- **Vývoj v oblasti přeshraničního předávání**: Rozhodnutí o odpovídající ochraně, aktualizace SCC, požadavky na lokalizaci dat

### Přístup k monitoringu

1. **Přihlaste se k odběru komunikace od regulatorních úřadů** (newslettery, RSS, oficiální oznámení)
2. **Sledujte relevantní právní publikace** pro analýzu nových vývojů
3. **Prostudujte novinky z profesních asociací** pro oborově specifická vodítka
4. **Veďte regulatorní kalendář** známých nadcházejících lhůt, dnů účinnosti a milníků souladu
5. **Informujte právní tým** o významných vývojích ovlivňujících zpracovatelské činnosti organizace

### Kritéria pro eskalaci

Eskalujte regulatorní vývoj na seniorního právníka nebo vedení, když:
- Nová regulace nebo vodítko přímo ovlivňuje klíčové obchodní činnosti organizace
- Sankční rozhodnutí v odvětví organizace signalizuje zvýšený dohled regulátorů
- Blíží se lhůta souladu, která vyžaduje organizační změny
- Je zpochybněn nebo zneplatněn mechanismus předávání údajů, o který se organizace opírá
- Regulatorní úřad zahájí šetření nebo vyšetřování týkající se organizace

## Tipy

1. **Buďte konkrétní** -- „Chceme poslat e-mail všem našim uživatelům" je lepší než „marketingová kampaň".
2. **Uveďte geografii** -- Požadavky na soulad se liší podle jurisdikce (ČR, EU, třetí země).
3. **Zmiňte data** -- O jaké osobní údaje jde? To určuje většinu požadavků na soulad.
