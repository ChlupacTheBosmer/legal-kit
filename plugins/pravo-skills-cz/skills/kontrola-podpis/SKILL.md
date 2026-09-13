---
name: kontrola-podpis
description: Připravte a nasměrujte dokument k elektronickému podpisu — ověřte oprávnění signatáře v obchodním rejstříku přes `lex`, projděte kontrolní seznam před podpisem, nastavte pořadí podepisování a odešlete k podpisu. Použijte, když je smlouva finalizována a připravena k podpisu, při ověřování názvů subjektů, příloh a podpisových bloků před odesláním nebo při sestavování obálky se sekvenčními či paralelními signatáři.
argument-hint: "<dokument nebo smlouva k odeslání>"
---

# /kontrola-podpis -- Kontrola a směrování elektronického podpisu

> Pokud narazíte na neznámé zástupné symboly nebo si potřebujete ověřit, které nástroje jsou propojeny, viz [CONNECTORS.md](../../CONNECTORS.md).

Připravte dokument k elektronickému podpisu — ověřte úplnost dokumentu, oprávnění signatáře protistrany a nasměrujte k podpisu.

**Důležité**: Tento skill pomáhá s právními workflow, ale neposkytuje právní poradenství ve smyslu zákona č. 85/1996 Sb. o advokacii. Před odesláním k podpisu ověřte, že je dokument ve finální podobě.

## Jak používat (pro uživatele)

Vyvolej skill `/kontrola-podpis` a přilož dokument k podpisu (PDF, DOCX, URL nebo textovou referenci na již známý dokument). AI provede:

1. **Ověření oprávnění signatáře protistrany** v obchodním rejstříku přes `lex` (statutární orgán, způsob jednání, prokura, plná moc).
2. **Kontrolní seznam před podpisem** — finální verze dokumentu, kompletní přílohy, správné názvy subjektů, podpisové bloky, interní schválení.
3. **Konfiguraci podepisování** — signatáři (jména, e-maily, role), pořadí (sekvenční × paralelní), interní schvalovatelé, příjemci v kopii.
4. **Nasměrování k podpisu** — pokud je připojený konektor pro elektronický podpis (Signi, DocuSign), vytvoří podpisovou obálku a odešle; jinak vygeneruje pokyny k manuálnímu podpisu.
5. **Strukturovaný výstup** — detaily smlouvy, výsledek checklistu, konfigurace podepisování, stav, další kroky.

> ⚙ Sekce s technickými detaily (názvy nástrojů, integrace) jsou ve zbytku skillu označené poznámkou „Pro AI agenta". Při čtení skillu jako uživatel je můžete přeskočit.

## Krok 0 — ověřené právní zdroje (`lex`)

Primární právní zdroje jsou v tomto projektu dostupné přes MCP server **`lex`**, který čte přímo z úředních zdrojů (e-Sbírka, EUR-Lex, rozhodnuti.nsoud.cz, NALUS, rozhodnuti.justice.cz, ARES). `lex` se nepoužívá a připojovat se nemá.

**Postup:**

1. Stav konektoru neověřuj — `lex` je součástí projektu a je dostupný vždy.
2. Právní oporu vždy dohledej v `lex` a cituj jen znění, které jsi skutečně přečetl, včetně data účinnosti.
3. Stanoviska ÚOOÚ hledej v `lex` přes `cz_guidance_search` — nikoli ručně na webu. Co `lex` nepokrývá (judikatura NSS a vrchních soudů, stanoviska ČNB, ÚOHS, ČTÚ, SÚKL a NÚKIB), dohledej ručně a v závěru výslovně uveď, že tato část nebyla ověřena proti primárnímu zdroji.

> ⚙ **Pro AI agenta — nástroje `lex`:** `legal_cite` (ověřená citace + přesné znění; použij vždy před zápisem citace do dokumentu), `cz_act_text` / `cz_act_versions` / `cz_act_toc` / `cz_act_info` / `cz_act_relations` (české předpisy z e-Sbírky, ve znění k datu), `eu_celex_lookup` / `eu_act_text` / `eu_act_metadata` / `eu_act_versions` / `eu_act_search` (právo EU z EUR-Lex), `cz_case_search` + `cz_case_text` (judikatura NS), `cz_us_search` + `cz_us_keywords` (judikatura ÚS a její věcný rejstřík), `cz_case_lower_search` (okresní a krajské soudy — pozor, jen v naindexovaném období, které nástroj vypisuje) a `cz_case_lower_scan` (procházení podle data), `cz_guidance_search` + `cz_guidance_text` (**stanoviska ÚOOÚ** — pro otázky GDPR je prohledej vždy; jde o výklad dozorového úřadu, nikoli závazné právo), `cz_company_search` + `cz_company` (ARES a obchodní rejstřík — IČO, sídlo, statutární orgán, způsob jednání). Dotazy do českých zdrojů piš **česky**. Nástroje `mcp__mcp-registry__*` v Claude Code neexistují — nevolej je.


## Použití

```
/kontrola-podpis $ARGUMENTS
```

Připravit k podpisu: @$1

## Ověření oprávnění k podpisu přes `lex`

Pokud je v Kroku 0 potvrzeno použití `lex`, ověř oprávnění signatáře protistrany **před odesláním dokumentu k podpisu**. Jde o nejčastější příčinu sporů o platnost smlouvy — podpis osoby bez oprávnění může způsobit, že smlouva není platně uzavřena.

Z výpisu z obchodního rejstříku přes `lex` zjisti:

- **Statutární orgán** protistrany (jednatel, představenstvo, ředitel) a den vzniku funkce.
- **Způsob jednání za společnost** — typické varianty:
  - „Jednatel jedná za společnost samostatně" → každý jednatel může podepsat sám.
  - „Společnost zastupují vždy dva jednatelé společně" → jeden podpis nestačí.
  - „Společnost zastupuje jednatel společně s prokuristou" / „dva členové představenstva" → vyžaduje kombinaci podpisů.
- **Prokura** — zda existuje, kdo je prokuristou a jaký je její rozsah. Prokura nezahrnuje zcizení a zatížení nemovitostí, není-li v zápisu výslovně uvedeno jinak (§ 453 OZ).
- **Sbírka listin** — zápis o volbě členů statutárního orgánu (kdy byli jmenováni, zda je funkce stále platná) a případná plná moc, je-li v rejstříku zapsaná.

Porovnej zjištěné údaje s podpisovým blokem ve smlouvě:

- **Pokud podepisuje jednatel uvedený v OR a způsob jednání to umožňuje** → OK, zaznamenej do kontroly.
- **Pokud podepisuje někdo jiný než statutární orgán** → ke smlouvě musí být přiložena **písemná plná moc** dle § 441 OZ, nebo na ni musí být v textu smlouvy odkázáno. Plná moc musí obsahovat výslovné oprávnění k podpisu této konkrétní smlouvy nebo k danému typu jednání. **Pokud plná moc chybí, signalizuj problém před odesláním a požádej o její doložení.**
- **Pokud podepisuje prokurista** → ověř rozsah prokury podle zápisu v OR.
- **Pokud nelze oprávnění z OR ověřit** (např. nový jednatel ještě není zapsaný) → doporuč před podpisem vyžádat aktuální výpis z OR nebo plnou moc přímo od protistrany.

> ⚙ **Pro AI agenta — nástroje `lex`:** `legal_cite` (ověřená citace + přesné znění; použij vždy před zápisem citace do dokumentu), `cz_act_text` / `cz_act_versions` / `cz_act_toc` / `cz_act_info` / `cz_act_relations` (české předpisy z e-Sbírky, ve znění k datu), `eu_celex_lookup` / `eu_act_text` / `eu_act_metadata` / `eu_act_versions` / `eu_act_search` (právo EU z EUR-Lex), `cz_case_search` + `cz_case_text` (judikatura NS), `cz_us_search` + `cz_us_keywords` (judikatura ÚS a její věcný rejstřík), `cz_case_lower_search` (okresní a krajské soudy — pozor, jen v naindexovaném období, které nástroj vypisuje) a `cz_case_lower_scan` (procházení podle data), `cz_guidance_search` + `cz_guidance_text` (**stanoviska ÚOOÚ** — pro otázky GDPR je prohledej vždy; jde o výklad dozorového úřadu, nikoli závazné právo), `cz_company_search` + `cz_company` (ARES a obchodní rejstřík — IČO, sídlo, statutární orgán, způsob jednání). Dotazy do českých zdrojů piš **česky**. Nástroje `mcp__mcp-registry__*` v Claude Code neexistují — nevolej je.

## Pracovní postup

### Krok 1: Přijetí dokumentu

Přijmi dokument v libovolném formátu:

- **Nahraný soubor**: PDF, DOCX
- **URL**: odkaz na dokument v ~~cloudovém úložišti nebo ~~CLM
- **Reference**: „Rámcová smlouva s Acme Corp, kterou jsme včera finalizovali"

### Krok 2: Kontrolní seznam před podpisem

Před odesláním k podpisu ověř:

```markdown
## Kontrolní seznam před podpisem

- [ ] Dokument je ve finální, odsouhlasené podobě (žádné otevřené redline úpravy)
- [ ] Všechny přílohy a dodatky jsou připojeny
- [ ] Správné názvy právních subjektů v podpisových blocích (ověřeno proti OR)
- [ ] Data jsou správná nebo ponechána prázdná pro datum podpisu
- [ ] Podpisové bloky odpovídají oprávněným osobám (ověřeno přes `lex` v sekci výše)
- [ ] Byla získána všechna požadovaná interní schválení
- [ ] Dokument byl zkontrolován příslušným právníkem
```

### Krok 3: Konfigurace podepisování

Shromáždi podrobnosti o podepisování:

- **Signatáři**: kdo musí podepsat? (jména, e-maily, funkce)
- **Pořadí podepisování**: sekvenční, nebo paralelní?
- **Interní schválení**: musí někdo z vaší strany schválit dokument předtím, než ho podepíše protistrana?
- **Příjemci v kopii (CC)**: kdo má obdržet kopii podepsaného dokumentu?

Pokud OR vyžaduje **dva jednatele společně**, upozorni uživatele, že jeden podpis nestačí — musí se přidat druhý signatář.

### Krok 4: Nasměrování k podpisu

**Pokud je ~~elektronický podpis propojen:**

- Vytvoř podpisovou obálku/žádost.
- Nastav podpisová pole a pořadí.
- Přidej případné požadované pole pro parafy nebo datum.
- Odešli k podpisu.

**Pokud není propojen:**

- Vygeneruj pokyny k podepsání.
- Poskytni dokument naformátovaný pro vlastnoruční podpis nebo manuální elektronický podpis.
- Uveď seznam všech signatářů s kontaktními údaji.

> **Poznámka k formě podpisu v ČR:** Podle zákona č. 297/2016 Sb. o službách vytvářejících důvěru pro elektronické transakce a nařízení eIDAS (EU) č. 910/2014 je **kvalifikovaný elektronický podpis (KEP)** nejvyšším standardem a je právně rovnocenný vlastnoručnímu podpisu. U úkonů vůči veřejné správě, některých katastrálních podání a u zvláštních forem podle § 560 a násl. OZ je KEP vyžadován. U běžných obchodních smluv stačí prostý nebo zaručený elektronický podpis (např. Signi, DocuSign).
>
> **AI nerozhoduje o požadované formě podpisu.** Posouzení, zda pro konkrétní právní úkon postačí prostý / zaručený / kvalifikovaný elektronický podpis, je **právní otázka, kterou musí posoudit kvalifikovaný advokát nebo právník**. Skill může uvést obecný rámec a upozornit na rizikové oblasti (úkony vůči katastru nemovitostí, datové schránky orgánů veřejné moci, právní úkony se zvláštní formou podle § 560+ OZ), ale konečné rozhodnutí o vhodné formě podpisu pro daný úkon ponech na uživateli a jeho právním poradci.

## Výstup

```markdown
## Žádost o podpis: [Název dokumentu]

### Podrobnosti dokumentu
- **Typ**: [rámcová smlouva / smlouva o mlčenlivosti / dílčí smlouva o dílo / dodatek atd.]
- **Smluvní strany**: [Strana A] a [Strana B]
- **Počet stran**: [X]

### Ověření oprávnění (`lex` OR)
- **Strana A (vaše)**: [jméno signatáře + statutární orgán + způsob jednání: OK]
- **Strana B (protistrana)**: [jméno signatáře + statutární orgán + způsob jednání: OK / vyžaduje plnou moc / vyžaduje druhý podpis]

### Kontrola před podpisem: [V POŘÁDKU / ZJIŠTĚNY PROBLÉMY]
[Uveď případné problémy, které je třeba vyřešit před odesláním.]

### Konfigurace podepisování
| Pořadí | Signatář | E-mail | Role |
|-------|--------|-------|------|
| 1 | [jméno] | [e-mail] | [oprávněná osoba Strany A] |
| 2 | [jméno] | [e-mail] | [oprávněná osoba Strany B] |

### Příjemci v kopii (CC)
- [jméno] — [e-mail]

### Stav
[Odesláno k podpisu / Připraveno k odeslání / Je třeba nejprve vyřešit problémy]

### Další kroky
- [Co lze očekávat po odeslání]
- [Očekávaná doba vyřízení]
- [Následný krok, pokud nebude podepsáno do X dnů]
```

## Tipy

1. **Pečlivě zkontroluj názvy subjektů** — Nejčastější chybou při podepisování jsou nesprávné názvy právních subjektů. Vždy ověř název, IČO a sídlo proti aktuálnímu výpisu z OR.
2. **Ověř oprávnění** — Ujisti se, že každý signatář je oprávněn zavazovat svou organizaci (statutární orgán nebo osoba s plnou mocí). KYC v OR je rychlejší a levnější než pozdější spor o platnost smlouvy kvůli neoprávněnému podpisu.
3. **Uchovej kopii** — Podepsané kopie ihned po podpisu ulož v ~~cloudovém úložišti nebo ~~CLM.
