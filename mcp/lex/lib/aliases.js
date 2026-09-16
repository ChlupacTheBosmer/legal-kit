/**
 * Short-name -> CELEX map for EU instruments that come up constantly in
 * IP / data-protection / AI-compliance work.
 *
 * Every entry in this file was verified against CELLAR metadata (title +
 * existence) on 2026-08-23 by mcp-servers/lex/selftest.js. Re-run the selftest
 * after editing. Aliases are a convenience only — the tools always report the
 * CELEX actually used, so a wrong alias is visible rather than silent.
 */
export const EU_ALIASES = {
  // Data protection
  "gdpr": "32016R0679",
  "general data protection regulation": "32016R0679",
  "obecne narizeni o ochrane osobnich udaju": "32016R0679",
  "led": "32016L0680",
  "law enforcement directive": "32016L0680",
  "eudpr": "32018R1725",
  "eprivacy": "32002L0058",
  "eprivacy directive": "32002L0058",
  "scc": "32021D0914",
  "standard contractual clauses": "32021D0914",

  // Digital / platform regulation
  "dsa": "32022R2065",
  "digital services act": "32022R2065",
  "dma": "32022R1925",
  "digital markets act": "32022R1925",
  "e-commerce directive": "32000L0031",
  "p2b": "32019R1150",
  "platform to business": "32019R1150",
  "emfa": "32024R1083",
  "european media freedom act": "32024R1083",

  // AI, data, cyber
  "ai act": "32024R1689",
  "artificial intelligence act": "32024R1689",
  "akt o umele inteligenci": "32024R1689",
  "data act": "32023R2854",
  "dga": "32022R0868",
  "data governance act": "32022R0868",
  "open data directive": "32019L1024",
  "nis2": "32022L2555",
  "cra": "32024R2847",
  "cyber resilience act": "32024R2847",
  "cybersecurity act": "32019R0881",
  "eidas2": "32024R1183",

  // Intellectual property
  "dsm": "32019L0790",
  "dsm copyright directive": "32019L0790",
  "copyright directive": "32019L0790",
  "infosoc": "32001L0029",
  "infosoc directive": "32001L0029",
  "software directive": "32009L0024",
  "computer programs directive": "32009L0024",
  "database directive": "31996L0009",
  "trade secrets directive": "32016L0943",
  "eutmr": "32017R1001",
  "eu trade mark regulation": "32017R1001",
  "ip enforcement directive": "32004L0048",
  "enforcement directive": "32004L0048",
  "eu design regulation": "32024R2822",
  "eu design directive": "32024L2823",

  // Consumer, product, employment
  "consumer rights directive": "32011L0083",
  "ucpd": "32005L0029",
  "unfair commercial practices directive": "32005L0029",
  "digital content directive": "32019L0770",
  "product liability directive": "32024L2853",
  "accessibility act": "32019L0882",
  "eaa": "32019L0882",
  "machinery regulation": "32023R1230",
  "platform work directive": "32024L2831",

  // Environment — assessment, nature, access to justice
  "eia directive": "32011L0092",
  "environmental impact assessment directive": "32011L0092",
  "smernice eia": "32011L0092",
  "sea directive": "32001L0042",
  "strategic environmental assessment directive": "32001L0042",
  "habitats directive": "31992L0043",
  "smernice o stanovistich": "31992L0043",
  "birds directive": "32009L0147",
  "smernice o ptacich": "32009L0147",
  "nature restoration regulation": "32024R1991",
  "nature restoration law": "32024R1991",
  "invasive alien species regulation": "32014R1143",
  "environmental information directive": "32003L0004",
  "aarhus regulation": "32006R1367",
  "environmental liability directive": "32004L0035",
  "eld": "32004L0035",
  "environmental crime directive": "32024L1203",

  // Environment — pollution, industry, chemicals
  "industrial emissions directive": "32010L0075",
  "ied": "32010L0075",
  "seveso iii": "32012L0018",
  "seveso directive": "32012L0018",
  "ambient air quality directive": "32024L2881",
  "air quality directive": "32024L2881",
  "environmental noise directive": "32002L0049",
  "reach": "32006R1907",
  "clp": "32008R1272",
  "clp regulation": "32008R1272",
  "pops regulation": "32019R1021",
  "mercury regulation": "32017R0852",
  "f-gas regulation": "32024R0573",

  // Environment — water and soil
  "water framework directive": "32000L0060",
  "wfd": "32000L0060",
  "ramcova smernice o vode": "32000L0060",
  "groundwater directive": "32006L0118",
  "environmental quality standards directive": "32008L0105",
  "urban waste water treatment directive": "32024L3019",
  "drinking water directive": "32020L2184",
  "floods directive": "32007L0060",
  "nitrates directive": "31991L0676",

  // Environment — waste and circular economy
  "waste framework directive": "32008L0098",
  "ramcova smernice o odpadech": "32008L0098",
  "landfill directive": "31999L0031",
  "waste shipment regulation": "32024R1157",
  "packaging regulation": "32025R0040",
  "ppwr": "32025R0040",
  "single use plastics directive": "32019L0904",
  "sup directive": "32019L0904",
  "weee directive": "32012L0019",
  "batteries regulation": "32023R1542",
  "end of life vehicles directive": "32000L0053",
  "ecodesign regulation": "32024R1781",
  "espr": "32024R1781",

  // Climate and sustainable finance
  "european climate law": "32021R1119",
  "climate law": "32021R1119",
  "eu ets": "32003L0087",
  "ets directive": "32003L0087",
  "emissions trading directive": "32003L0087",
  "effort sharing regulation": "32018R0842",
  "esr": "32018R0842",
  "lulucf regulation": "32018R0841",
  "cbam": "32023R0956",
  "carbon border adjustment mechanism": "32023R0956",
  "eudr": "32023R1115",
  "deforestation regulation": "32023R1115",
  "csrd": "32022L2464",
  "corporate sustainability reporting directive": "32022L2464",
  "csddd": "32024L1760",
  "cs3d": "32024L1760",
  "corporate sustainability due diligence directive": "32024L1760",
  "taxonomy regulation": "32020R0852",
  "sfdr": "32019R2088",
  "red": "32018L2001",
  "renewable energy directive": "32018L2001",
  "energy efficiency directive": "32023L1791",
};

/**
 * Frequently used Czech acts, by number/year in the Sbírka zákonů.
 * Verified against e-Sbírka on 2026-08-23 by selftest.js.
 */
export const CZ_ALIASES = {
  "autorsky zakon": { number: 121, year: 2000 },
  "copyright act": { number: 121, year: 2000 },
  "obcansky zakonik": { number: 89, year: 2012 },
  "civil code": { number: 89, year: 2012 },
  "zakon o obchodnich korporacich": { number: 90, year: 2012 },
  "zokd": { number: 90, year: 2012 },
  "zakon o zpracovani osobnich udaju": { number: 110, year: 2019 },
  "zzou": { number: 110, year: 2019 },
  "zakon o sluzbach informacni spolecnosti": { number: 480, year: 2004 },
  "zakon o ochrannych znamkach": { number: 441, year: 2003 },
  "trademark act": { number: 441, year: 2003 },
  "patentovy zakon": { number: 527, year: 1990 },
  "zakon o vynalezech": { number: 527, year: 1990 },
  "zakon o uzitnych vzorech": { number: 478, year: 1992 },
  "zakon o prumyslovych vzorech": { number: 207, year: 2000 },
  "zakon o vymahani prav z prumysloveho vlastnictvi": { number: 221, year: 2006 },
  "zakonik prace": { number: 262, year: 2006 },
  "labour code": { number: 262, year: 2006 },
  "zivnostensky zakon": { number: 455, year: 1991 },
  "zakon o ochrane spotrebitele": { number: 634, year: 1992 },
  "zakon o ochrane hospodarske souteze": { number: 143, year: 2001 },
  "spravni rad": { number: 500, year: 2004 },
  "obcansky soudni rad": { number: 99, year: 1963 },
  "trestni zakonik": { number: 40, year: 2009 },
  "zakon o dph": { number: 235, year: 2004 },
  "zakon o danich z prijmu": { number: 586, year: 1992 },
  "zakon o kyberneticke bezpecnosti": { number: 264, year: 2025 },
  "nis2 czech implementation": { number: 264, year: 2025 },
  "zakon o kyberneticke bezpecnosti 2014": { number: 181, year: 2014 }, // repealed 2025-11-01 by 264/2025 Sb.
  "zakon o sbirce zakonu": { number: 222, year: 2016 },
  "zakon o pravu na digitalni sluzby": { number: 12, year: 2020 },
  "zakon o sluzbach vytvarejicich duveru": { number: 297, year: 2016 },
  "zakon o elektronickych ukonech": { number: 300, year: 2008 },
  "aml zakon": { number: 253, year: 2008 },

  // Administrative justice and administrative procedure — the procedural spine
  // of Czech environmental law, which is administrative law almost throughout.
  "soudni rad spravni": { number: 150, year: 2002 },
  "srs": { number: 150, year: 2002 },
  "code of administrative justice": { number: 150, year: 2002 },
  "zakon o odpovednosti za prestupky": { number: 250, year: 2016 },
  "prestupkovy zakon": { number: 250, year: 2016 },
  "kontrolni rad": { number: 255, year: 2012 },

  // Environment — framework, assessment, nature
  "zakon o zivotnim prostredi": { number: 17, year: 1992 },
  "zakon o ochrane prirody a krajiny": { number: 114, year: 1992 },
  "zopk": { number: 114, year: 1992 },
  "zakon o posuzovani vlivu na zivotni prostredi": { number: 100, year: 2001 },
  "eia zakon": { number: 100, year: 2001 },
  "zakon o jednotnem environmentalnim stanovisku": { number: 148, year: 2023 },
  "jes": { number: 148, year: 2023 },
  "zakon o pravu na informace o zivotnim prostredi": { number: 123, year: 1998 },
  "zakon o predchazeni ekologicke ujme": { number: 167, year: 2008 },
  "zakon o ekologicke ujme": { number: 167, year: 2008 },

  // Environment — sectoral
  "vodni zakon": { number: 254, year: 2001 },
  "zakon o vodovodech a kanalizacich": { number: 274, year: 2001 },
  "zakon o odpadech": { number: 541, year: 2020 },
  "zakon o vyrobcich s ukoncenou zivotnosti": { number: 542, year: 2020 },
  "zakon o obalech": { number: 477, year: 2001 },
  "zakon o ochrane ovzdusi": { number: 201, year: 2012 },
  "zakon o integrovane prevenci": { number: 76, year: 2002 },
  "ippc zakon": { number: 76, year: 2002 },
  "zakon o prevenci zavaznych havarii": { number: 224, year: 2015 },
  "chemicky zakon": { number: 350, year: 2011 },
  "lesni zakon": { number: 289, year: 1995 },
  "zakon o ochrane zemedelskeho pudniho fondu": { number: 334, year: 1992 },
  "zakon o myslivosti": { number: 449, year: 2001 },
  "zakon o rybarstvi": { number: 99, year: 2004 },
  "zakon na ochranu zvirat proti tyrani": { number: 246, year: 1992 },
  "horni zakon": { number: 44, year: 1988 },
  "geologicky zakon": { number: 62, year: 1988 },
  "atomovy zakon": { number: 263, year: 2016 },
  "stavebni zakon": { number: 283, year: 2021 },
  "zakon o obchodovani s povolenkami": { number: 383, year: 2012 },
  "zakon o podporovanych zdrojich energie": { number: 165, year: 2012 },
  "zakon o hospodareni energii": { number: 406, year: 2000 },
  "energeticky zakon": { number: 458, year: 2000 },
  "zakon o ochrane verejneho zdravi": { number: 258, year: 2000 },
};

const fold = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function resolveEuAlias(name) {
  const key = fold(name);
  if (EU_ALIASES[key]) return EU_ALIASES[key];
  for (const [k, v] of Object.entries(EU_ALIASES)) if (fold(k) === key) return v;
  return null;
}

export function resolveCzAlias(name) {
  const key = fold(name);
  if (CZ_ALIASES[key]) return CZ_ALIASES[key];
  for (const [k, v] of Object.entries(CZ_ALIASES)) if (fold(k) === key) return v;
  return null;
}
