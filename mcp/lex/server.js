#!/usr/bin/env node
/**
 * lex-mcp — primary legal sources over MCP.
 *
 * Czech law  : e-Sbírka (Ministry of the Interior), the legally authoritative
 *              publication channel since 1 Jan 2024 under Act No. 222/2016 Coll.
 * EU law     : CELLAR / EUR-Lex (Publications Office of the European Union).
 *
 * Design rules:
 *  - Every result carries the official source URL and the retrieval date, so a
 *    citation can be written without a second lookup.
 *  - Nothing is silently truncated; cut-off text is marked explicitly.
 *  - Version state is never guessed: Czech texts are addressed by the date the
 *    consolidated version took effect, EU texts by CELEX (original or
 *    consolidated), and both are reported back verbatim.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import * as cz from "./lib/esbirka.js";
import * as eu from "./lib/eurlex.js";
import * as ares from "./lib/ares.js";
import * as cl from "./lib/caselaw.js";
import { cite } from "./lib/cite.js";
import * as uoou from "./lib/uoou.js";
import * as nalus from "./lib/nalus.js";
import * as justice from "./lib/justice.js";
import * as cjeu from "./lib/cjeu.js";
import * as nss from "./lib/nss.js";
import * as mzp from "./lib/mzp.js";
import { englishQueryWarning } from "./lib/czsearch.js";
import { clamp } from "./lib/format.js";
import { todayISO } from "./lib/http.js";
import { EU_ALIASES, CZ_ALIASES, resolveEuAlias, resolveCzAlias } from "./lib/aliases.js";

const server = new McpServer({ name: "lex", version: "0.1.0" });

const text = (s) => ({ content: [{ type: "text", text: s }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

async function guard(fn) {
  try {
    return await fn();
  } catch (err) {
    return fail(`ERROR: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ Czech */

const czRef = {
  number: z.union([z.number().int(), z.string()]).describe('Act number in the collection, e.g. 121 for "121/2000 Sb."'),
  year: z.union([z.number().int(), z.string()]).describe('Year of the collection, e.g. 2000 for "121/2000 Sb."'),
  collection: z.enum(["sb", "ms"]).default("sb")
    .describe('"sb" = Sbírka zákonů (Collection of Laws), "ms" = Sbírka mezinárodních smluv (international treaties)'),
};

const versionArg = z.string().default("current")
  .describe('"current" for the version in force today, or an ISO date (YYYY-MM-DD) to get the version in force on that date');

function czHeader(ref, version, repealed = false) {
  return [
    `# ${cz.citationOf(ref)} — consolidated version in force from ${version.effectiveFrom}` +
      (version.effectiveTo ? ` to ${version.effectiveTo}` : " (current)"),
    ``,
    repealed
      ? `!! REPEALED — no version of this act is in force today. The text below is the last version that was in force (until ${version.effectiveTo}). Check cz_act_relations type=JE_RUSEN for the act that replaced it.`
      : null,
    repealed ? `` : null,
    `Source: e-Sbírka (Ministry of the Interior of the Czech Republic) — ${cz.permalink(version.staleUrl)}`,
    `Version status: ${version.status} · version no. ${version.versionNumber} · retrieved ${todayISO()}`,
    ``,
  ].filter((l) => l !== null).join("\n");
}

server.registerTool(
  "cz_act_versions",
  {
    title: "Czech act — version history",
    description:
      "List every consolidated version of a Czech act from e-Sbírka, with the date each took effect, the amending act that produced it, and which version is currently in force. Use this before quoting a Czech act so the right time-version is cited.",
    inputSchema: czRef,
  },
  async (args) =>
    guard(async () => {
      const ref = cz.normalizeRef(args);
      const all = await cz.versions(ref);
      const lines = all.map((v) => {
        const range = `${v.effectiveFrom} → ${v.effectiveTo || "(open)"}`;
        const amend = v.amendedBy.length ? ` · introduced by ${v.amendedBy.map((a) => a.citation).join(", ")}` : "";
        const mark = v.status === "AKTUALNI" ? "  <- IN FORCE NOW" : v.status === "BUDOUCI" ? "  <- future" : "";
        return `- v${v.versionNumber}  ${range}${amend}${mark}\n  ${cz.permalink(v.staleUrl)}`;
      });
      return text(
        [
          `# ${cz.citationOf(ref)} — ${all.length} consolidated versions`,
          ``,
          `Promulgated ${all[all.length - 1]?.promulgated || "n/a"}. Source: e-Sbírka, retrieved ${todayISO()}.`,
          ``,
          ...lines,
        ].join("\n")
      );
    })
);

server.registerTool(
  "cz_act_text",
  {
    title: "Czech act — official text",
    description:
      "Fetch the official consolidated text of a Czech act (or one section of it) from e-Sbírka. Set `section` to a single provision such as '§ 30' or 'ČÁST PRVNÍ' to get just that unit and everything nested under it. Returns the exact wording as published by the Ministry of the Interior.",
    inputSchema: {
      ...czRef,
      version: versionArg,
      section: z.string().optional()
        .describe("A single provision label, e.g. '§ 30', '30', '§ 12a', 'ČÁST PRVNÍ'. Omit for the whole act."),
      max_chars: z.number().int().min(500).max(400_000).default(60_000)
        .describe("Hard cap on returned characters; any cut is marked explicitly."),
    },
  },
  async (args) =>
    guard(async () => {
      const ref = cz.normalizeRef(args);
      const { version, repealed } = await cz.resolveVersion(ref, args.version);
      const doc = await cz.fragments(version.staleUrl);
      let frags = doc.fragments;

      if (args.section) {
        const slice = cz.sliceSection(frags, args.section);
        if (!slice) {
          const labels = cz.addressableLabels(frags);
          return fail(
            `ERROR: section "${args.section}" not found in ${cz.citationOf(ref)} (version ${version.effectiveFrom}).\n` +
              `Available units include: ${labels.slice(0, 60).join(", ")}${labels.length > 60 ? ` … (${labels.length} total)` : ""}`
          );
        }
        frags = slice;
      }

      const body = cz.renderFragments(frags);
      const scope = args.section ? `Section requested: ${args.section}` : "Scope: full act";
      return text(
        czHeader(ref, version, repealed) +
          `${scope}\n\n---\n\n` +
          clamp(body, args.max_chars, "Narrow the request with `section`, or raise max_chars.")
      );
    })
);

server.registerTool(
  "cz_act_toc",
  {
    title: "Czech act — table of contents",
    description:
      "Top-level structure of a Czech act (parts, headings, section ranges) from e-Sbírka. Cheap way to find which provision to read before pulling full text.",
    inputSchema: { ...czRef, version: versionArg },
  },
  async (args) =>
    guard(async () => {
      const ref = cz.normalizeRef(args);
      const { version, repealed } = await cz.resolveVersion(ref, args.version);
      const toc = await cz.tableOfContents(version.staleUrl);
      const lines = toc.map((t) => `- ${[t.label, t.title].filter(Boolean).join(" — ")}${t.range ? `  (${t.range})` : ""}`);
      return text(czHeader(ref, version, repealed) + `## Contents\n\n` + (lines.join("\n") || "(no structured contents returned)"));
    })
);

server.registerTool(
  "cz_act_info",
  {
    title: "Czech act — identity and metadata",
    description:
      "Official title, short names, act type, approval date, subject-matter classification and the official PDF of a Czech act, plus its stable e-Sbírka permalink. Use this to confirm you have the right act before citing it.",
    inputSchema: { ...czRef, version: versionArg },
  },
  async (args) =>
    guard(async () => {
      const ref = cz.normalizeRef(args);
      const { version, all, repealed } = await cz.resolveVersion(ref, args.version);
      const [info, dl, doc] = await Promise.all([
        cz.getJSONInfo(version.staleUrl),
        cz.downloadLinks(version.staleUrl).catch(() => null),
        cz.fragments(version.staleUrl),
      ]);
      const byType = (t) => doc.fragments.find((f) => f.type === t)?.text || "";
      const title = byType("Prefix_Title") || byType("Prefix_Type");
      const lines = [
        `# ${cz.citationOf(ref)} — ${title || "(title unavailable)"}`,
        ``,
        `Act type: ${info.podtypAktuKod || "?"} · approved ${info.datumSchvaleni || "?"} · ${all.length} consolidated versions`,
        `Version shown: in force from ${version.effectiveFrom}${version.effectiveTo ? ` to ${version.effectiveTo}` : " (current)"} (${version.status})`,
        repealed ? `!! REPEALED — no version of this act is in force today; the last one expired ${version.effectiveTo}.` : null,
        info.dalsiNazvy?.length ? `Common abbreviations: ${info.dalsiNazvy.map((s) => s.trim()).filter(Boolean).join(", ")}` : null,
        info.czechVocPravniOblasti?.length
          ? `Legal areas: ${info.czechVocPravniOblasti.map((c) => c.preferovanyTerminTextNazvu).join(", ")}`
          : null,
        ``,
        `Permalink (ELI): ${cz.permalink(version.staleUrl)}`,
        `Linked-data record: ${cz.eliDataUrl(version.staleUrl)}`,
        dl?.overeneZneni ? `Promulgated PDF: part ${dl.overeneZneni.cisloCastky}/${dl.overeneZneni.rokCastky} of the collection` : null,
        ``,
        `Retrieved ${todayISO()} from e-Sbírka (Ministry of the Interior of the Czech Republic).`,
      ].filter((l) => l !== null);
      return text(lines.join("\n"));
    })
);

server.registerTool(
  "cz_act_relations",
  {
    title: "Czech act — relations to other acts and to EU law",
    description:
      "Which acts amend, repeal, implement or reference this Czech act, and which EU instruments it points to (ODKAZUJE_DO_EU). The EU link is the fastest way to see what a Czech act transposes.",
    inputSchema: {
      ...czRef,
      version: versionArg,
      type: z.string().optional()
        .describe("Filter to one relation type, e.g. MENI, JE_MENEN, RUSI, ODKAZUJE, JE_ODKAZOVAN, ODKAZUJE_DO_EU"),
      limit: z.number().int().min(1).max(200).default(25).describe("Max documents listed per relation type"),
    },
  },
  async (args) =>
    guard(async () => {
      const ref = cz.normalizeRef(args);
      const { version, repealed } = await cz.resolveVersion(ref, args.version);
      const data = await cz.relations(version.staleUrl);
      let groups = data.souvislosti || [];
      if (args.type) groups = groups.filter((g) => g.typ === String(args.type).toUpperCase());
      if (!groups.length) {
        return text(
          czHeader(ref, version, repealed) +
            `No relations${args.type ? ` of type ${args.type}` : ""} recorded. Types present: ${(data.souvislosti || []).map((g) => g.typ).join(", ") || "none"}`
        );
      }
      // A relation group carries its targets in up to three arrays. EU
      // instruments arrive in `dokumentEurlex` with a CELEX and no e-Sbírka
      // URL, so a renderer that reads only `dokumentySbirky` prints the count
      // and none of the rows — which is what ODKAZUJE_DO_EU used to do, i.e.
      // silently hide the transposition list, the most useful relation there is.
      const out = groups.map((g) => {
        const sb = [...(g.dokumentySbirky || []), ...(g.ostatniDokumentySbirky || [])].map((d) => {
          const state = d.stavDokumentuSbirky ? ` [${d.stavDokumentuSbirky}]` : "";
          const link = d.staleUrl ? ` — ${cz.permalink(d.staleUrl)}` : "";
          return `  - ${d.kodDokumentuSbirky || "?"} ${d.nazev || ""}${state}${link}`;
        });
        const eurlex = (g.dokumentEurlex || []).map((d) => {
          const link = eu.safeUiUrl(d.celex, "cs");
          return `  - CELEX ${d.celex || "?"} ${d.nazev || ""}${link ? ` — ${link}` : ""}`;
        });
        const all = [...sb, ...eurlex];
        const items = all.slice(0, args.limit);
        // Count from the rows actually held, not from pocetDokumentuSbirky:
        // that field counts only the Sb. array and understates EU-only groups.
        const held = Math.max(all.length, Number(g.pocetDokumentuSbirky) || 0);
        const more = held > items.length ? `\n  … ${held - items.length} more not listed` : "";
        return `### ${g.typ} (${held})\n${items.join("\n")}${more}`;
      });
      return text(czHeader(ref, version, repealed) + out.join("\n\n"));
    })
);

/* --------------------------------------------------------------------- EU */

server.registerTool(
  "eu_act_search",
  {
    title: "EU law — search titles",
    description:
      "Full-text search over EUR-Lex/CELLAR document titles, returning CELEX numbers. Use it to find the CELEX for an instrument you only know by description. For well-known acts prefer eu_celex_lookup.",
    inputSchema: {
      query: z.string().describe("Words that appear in the title, e.g. 'artificial intelligence harmonised rules'"),
      language: z.string().default("en").describe("Language of the titles searched and returned (en, cs, de, …)"),
      year: z.union([z.number().int(), z.string()]).optional().describe("Restrict to acts adopted in this year"),
      celex_prefix: z.string().optional()
        .describe("Restrict by CELEX prefix, e.g. '32024R' for 2024 regulations, '32019L' for 2019 directives"),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async (args) =>
    guard(async () => {
      const rows = await eu.search({
        query: args.query,
        language: args.language,
        year: args.year,
        celexPrefix: args.celex_prefix,
        limit: args.limit,
      });
      if (!rows.length) {
        return text(
          `No CELLAR title matches for "${args.query}"${args.year ? ` in ${args.year}` : ""}. ` +
            `The index matches whole words in the title only — try fewer or different words, or drop the year filter.`
        );
      }
      const lines = rows.map((r) => `- ${r.celex}${r.date ? ` (${r.date})` : ""}\n  ${r.title}\n  ${eu.uiUrl(r.celex, args.language)}`);
      return text(
        `# EUR-Lex title search: "${args.query}" — ${rows.length} result(s)\n\n` +
          `Source: CELLAR SPARQL endpoint (Publications Office of the EU), retrieved ${todayISO()}.\n` +
          `CELEX numbers beginning "0" are consolidated texts; "3" is the act as adopted.\n\n` +
          lines.join("\n")
      );
    })
);

server.registerTool(
  "eu_celex_lookup",
  {
    title: "EU law — resolve a short name to CELEX",
    description:
      "Turn a common short name (GDPR, AI Act, DSA, DSM Copyright Directive, NIS2, …) into its CELEX number, with the official title and force status confirmed against CELLAR. Call with no name to list every known alias.",
    inputSchema: {
      name: z.string().optional().describe("Short name, e.g. 'GDPR', 'AI Act', 'DSM copyright directive'"),
      language: z.string().default("en"),
    },
  },
  async (args) =>
    guard(async () => {
      if (!args.name) {
        const eu_ = Object.entries(EU_ALIASES).map(([k, v]) => `- ${k} → ${v}`).join("\n");
        const cz_ = Object.entries(CZ_ALIASES).map(([k, v]) => `- ${k} → ${v.number}/${v.year} Sb.`).join("\n");
        return text(`# Known aliases\n\n## EU (CELEX)\n${eu_}\n\n## Czech (Sbírka zákonů)\n${cz_}`);
      }
      const celex = resolveEuAlias(args.name);
      if (!celex) {
        const czHit = resolveCzAlias(args.name);
        if (czHit) {
          return text(
            `"${args.name}" is a Czech act, not an EU one: ${czHit.number}/${czHit.year} Sb. ` +
              `Use cz_act_info with number=${czHit.number}, year=${czHit.year}.`
          );
        }
        return fail(
          `ERROR: no alias for "${args.name}". Call eu_celex_lookup with no name to list aliases, or use eu_act_search to find the CELEX by title.`
        );
      }
      const m = await eu.metadata(celex, args.language);
      return text(
        [
          `# ${args.name} → CELEX ${m.celex}`,
          ``,
          m.title || "(title unavailable in this language)",
          ``,
          `In force: ${m.inForce === null ? "unknown" : m.inForce ? "yes" : "no"} · entered into force ${m.entryIntoForce || "?"}` +
            (m.endOfValidity && m.endOfValidity !== "9999-12-31" ? ` · end of validity ${m.endOfValidity}` : ""),
          m.eli ? `ELI: ${m.eli}` : null,
          `EUR-Lex: ${m.uiUrl}`,
          ``,
          `Retrieved ${todayISO()} from CELLAR (Publications Office of the EU).`,
        ].filter(Boolean).join("\n")
      );
    })
);

server.registerTool(
  "eu_act_metadata",
  {
    title: "EU law — metadata for a CELEX",
    description:
      "Title, adoption date, entry into force, end of validity, in-force flag and ELI for a CELEX number, straight from CELLAR. Use before citing an EU act to confirm it is still in force.",
    inputSchema: {
      celex: z.string().describe("CELEX number, e.g. 32016R0679 (as adopted) or 02016R0679-20160504 (consolidated)"),
      language: z.string().default("en"),
    },
  },
  async (args) =>
    guard(async () => {
      const m = await eu.metadata(args.celex, args.language);
      return text(
        [
          `# CELEX ${m.celex}`,
          ``,
          m.title || "(title unavailable in this language)",
          ``,
          `Document date: ${m.dateDocument || "?"}`,
          `Entry into force: ${m.entryIntoForce || "?"}`,
          `End of validity: ${m.endOfValidity && m.endOfValidity !== "9999-12-31" ? m.endOfValidity : "none recorded"}`,
          `In force: ${m.inForce === null ? "unknown" : m.inForce ? "yes" : "no"}`,
          m.eli ? `ELI: ${m.eli}` : null,
          ``,
          `EUR-Lex page: ${m.uiUrl}`,
          `CELLAR resource: ${m.cellarUrl}`,
          ``,
          `Retrieved ${todayISO()} from CELLAR (Publications Office of the EU).`,
        ].filter(Boolean).join("\n")
      );
    })
);

server.registerTool(
  "eu_act_versions",
  {
    title: "EU law — consolidated versions",
    description:
      "List the consolidated versions of an EU act (CELEX numbers beginning 0…). A regulation that has been amended must be quoted from the right consolidated text — this shows which ones exist.",
    inputSchema: { celex: z.string().describe("Base CELEX of the act, e.g. 32016R0679") },
  },
  async (args) =>
    guard(async () => {
      const list = await eu.consolidatedVersions(args.celex);
      if (!list.length) {
        return text(
          `CELLAR records no consolidated version for ${args.celex}. That normally means the act has never been amended, ` +
            `so the text as adopted (${args.celex}) is the one in force. Confirm at ${eu.uiUrl(args.celex)}.`
        );
      }
      const lines = list.map((v) => `- ${v.celex} — consolidated as at ${v.consolidatedAt}\n  ${eu.uiUrl(v.celex)}`);
      return text(
        `# Consolidated versions of ${args.celex} (${list.length})\n\n` +
          `Newest first. Source: CELLAR SPARQL endpoint, retrieved ${todayISO()}.\n\n` +
          lines.join("\n")
      );
    })
);

server.registerTool(
  "eu_act_text",
  {
    title: "EU law — official text",
    description:
      "Fetch the official text of an EU act from CELLAR in any EU language. Set `article` to pull a single article instead of the whole instrument. For an amended act, pass the consolidated CELEX (from eu_act_versions) rather than the CELEX as adopted.",
    inputSchema: {
      celex: z.string().describe("CELEX number, e.g. 32016R0679 or 02024R1689-20260727"),
      language: z.string().default("en").describe("EU official language code (en, cs, de, fr, …)"),
      article: z.union([z.number().int(), z.string()]).optional()
        .describe("Article number to extract, e.g. 30 or '6'. Omit for the whole text."),
      max_chars: z.number().int().min(500).max(400_000).default(60_000),
    },
  },
  async (args) =>
    guard(async () => {
      const res = await eu.fetchText(args.celex, args.language);
      let body = res.text;
      let scope = "Scope: full document (recitals and enacting terms)";
      if (args.article !== undefined) {
        const sliced = eu.sliceArticle(body, args.article, args.language);
        if (!sliced) {
          return fail(
            `ERROR: could not locate Article ${args.article} in CELEX ${res.celex} (${res.language}). ` +
              `Article extraction works on heading lines; fetch without \`article\` and search the text, or check ${eu.uiUrl(res.celex, args.language)}.`
          );
        }
        body = sliced;
        scope = `Scope: Article ${args.article} only (extracted from the full text)`;
      }
      return text(
        [
          `# CELEX ${res.celex} — official text (${res.language})`,
          ``,
          `Source: CELLAR, Publications Office of the EU — ${eu.cellarUrl(res.celex)}`,
          `EUR-Lex page: ${eu.uiUrl(res.celex, args.language)}`,
          `${scope} · retrieved ${todayISO()}`,
          ``,
          `---`,
          ``,
          clamp(body, args.max_chars, "Narrow the request with `article`, or raise max_chars."),
        ].join("\n")
      );
    })
);

/* ------------------------------------------- Czech companies (ARES) */

server.registerTool(
  "cz_company_search",
  {
    title: "Czech company — search",
    description:
      "Find a Czech legal entity or sole trader in ARES, the Ministry of Finance's register of economic entities. Use it to get the exact legal name and IČO before naming a counterparty in a contract, DPA, or demand letter.",
    inputSchema: {
      name: z.string().optional().describe("Business name or part of it, e.g. 'Seznam.cz'"),
      ico: z.union([z.number().int(), z.string()]).optional().describe("IČO, if you already have it"),
      municipality: z.string().optional().describe("Restrict to a registered seat, e.g. 'Praha', 'Brno'"),
      limit: z.number().int().min(1).max(200).default(10),
    },
  },
  async (args) =>
    guard(async () => {
      const r = await ares.search(args);
      if (!r.items.length) return text(`No ARES entity matched. Search is on the registered name, so try a shorter fragment.`);
      const lines = r.items.map(
        (e) =>
          `- **${e.name}** — IČO ${e.ico}\n  ${e.legalForm} · seat: ${e.seat || "?"}` +
          `\n  established ${e.established || "?"}${e.dissolved ? ` · DISSOLVED ${e.dissolved}` : ""}` +
          `\n  ${ares.aresUrl(e.ico)}`
      );
      return text(
        `# ARES search — ${r.items.length} shown of ${r.total}\n\n` +
          `Source: ARES (Ministry of Finance of the Czech Republic), retrieved ${todayISO()}.\n\n` +
          lines.join("\n")
      );
    })
);

server.registerTool(
  "cz_company",
  {
    title: "Czech company — full record",
    description:
      "Everything ARES holds on one IČO: legal name, VAT number, legal form, registered seat, and — from the Commercial Register — the statutory bodies and how the company must be represented when signing. Check this before relying on who signed a contract.",
    inputSchema: {
      ico: z.union([z.number().int(), z.string()]).describe("IČO, e.g. 26168685"),
    },
  },
  async (args) =>
    guard(async () => {
      const d = await ares.detail(args.ico);
      let vr = null;
      let vrNote = null;
      try {
        vr = await ares.commercialRegister(args.ico);
      } catch (e) {
        vrNote = e.message;
      }
      const lines = [
        `# ${d.name} — IČO ${d.ico}`,
        ``,
        `Legal form: ${d.legalForm}`,
        `VAT ID: ${d.vatId || "not VAT-registered in ARES"}`,
        `Registered seat: ${d.seat || "?"}`,
        d.postalAddress && d.postalAddress !== d.seat ? `Postal address: ${d.postalAddress}` : null,
        `Established: ${d.established || "?"}${d.dissolved ? ` · **DISSOLVED ${d.dissolved}**` : ""}`,
        `ARES record last updated: ${d.lastUpdated || "?"}`,
        ``,
      ];
      if (vr) {
        lines.push(
          `## Commercial Register`,
          ``,
          `File number: ${vr.fileNumber || "?"} · registered since ${vr.registeredSince || "?"}` +
            (vr.capital ? ` · registered capital ${vr.capital}` : ""),
          vr.status ? `Status: ${vr.status}` : null,
          ``,
          `**How it must be represented:**`,
          ...(vr.actingRules.length
            ? vr.actingRules.map((a) => `> ${a.rule}${a.organ ? `  — ${a.organ}` : ""}${a.since ? ` (since ${a.since})` : ""}`)
            : ["> (not recorded)"]),
          ``,
          `**Statutory bodies (current):**`,
          ...(vr.statutoryBodies.length
            ? vr.statutoryBodies.map((p) => `- ${p.name}${p.role ? ` — ${p.role}` : ""}${p.organ ? ` (${p.organ})` : ""}${p.since ? `, since ${p.since}` : ""}`)
            : ["- (none recorded)"]),
          ``
        );
      } else {
        lines.push(`## Commercial Register`, ``, `Not available: ${vrNote}`, ``);
      }
      lines.push(
        `ARES: ${ares.aresUrl(d.ico)}`,
        `Commercial Register (justice.cz): ${ares.justiceUrl(d.ico)}`,
        ``,
        `Retrieved ${todayISO()} from ARES (Ministry of Finance of the Czech Republic).`
      );
      return text(lines.filter((l) => l !== null).join("\n"));
    })
);

/* ------------------------------------------------- Czech case law */

server.registerTool(
  "cz_case_search",
  {
    title: "Czech case law — search the Supreme Court",
    description:
      "Search the Nejvyšší soud database (all published Supreme Court decisions) by full text, legal thesis, keyword, case number, ECLI, date, decision type or publication category. Combine criteria — they are ANDed. Returns case numbers and document ids for cz_case_text. Categories: A = published in the official collection, B/C/D/E = decreasing precedential weight.",
    inputSchema: {
      text: z.string().optional().describe("Words appearing in the decision text, e.g. 'autorské dílo'"),
      legal_thesis: z.string().optional().describe("Words in the právní věta (headnote) — narrows to decisions with a formulated legal proposition"),
      keyword: z.string().optional().describe("Exact index keyword (heslo), e.g. 'Autorské právo'"),
      annotation: z.string().optional().describe("Words in the annotation"),
      case_number: z.string().optional().describe("Full case number, e.g. '23 Cdo 3492/2021'"),
      ecli: z.string().optional().describe("ECLI, e.g. 'ECLI:CZ:NS:2022:23.CDO.3492.2021.1'"),
      date_from: z.string().optional().describe("Decided on or after this ISO date (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("Decided on or before this ISO date (YYYY-MM-DD)"),
      decision_type: z.string().optional().describe("e.g. 'Rozsudek' (judgment), 'Usnesení' (resolution)"),
      category: z.string().optional().describe("Publication category: A, B, C, D or E"),
      limit: z.number().int().min(1).max(100).default(20),
      start: z.number().int().min(1).default(1).describe("1-based offset of the first result; for the next page pass start + limit"),
    },
  },
  async (args) =>
    guard(async () => {
      for (const f of ["text", "legal_thesis", "annotation", "keyword"]) {
        const en = args[f] && englishQueryWarning(args[f]);
        if (en) return fail(`ERROR (${f}): ${en}`);
      }
      const r = await cl.nsSearch(args);
      if (!r.items.length) {
        return text(
          `No Supreme Court decision matched.\n\nQuery sent: \`${r.query}\`\n\n` +
            `Full-text search is on whole words. Try a shorter phrase, drop a criterion, or search by keyword instead of free text.`
        );
      }
      const lines = r.items.map(
        (i) =>
          `- **${i.caseNumber}**${i.category ? ` [category ${i.category}]` : ""}\n` +
          `  document id: \`${i.unid}\`  → cz_case_text court="ns"\n  ${i.pageUrl}${i.pdfUrl ? `\n  PDF: ${i.pdfUrl}` : ""}`
      );
      return text(
        `# Nejvyšší soud — ${r.shown} shown${r.total != null ? ` of ${r.total} matching` : ""}\n\n` +
          `Query: \`${r.query}\`\n` +
          `Source: rozhodnuti.nsoud.cz, retrieved ${todayISO()}.\n\n` +
          lines.join("\n") +
          (r.total != null && (args.start || 1) - 1 + r.shown < r.total
            ? `\n\nMore results (${r.total} total): repeat with start=${(args.start || 1) + r.shown}.`
            : "")
      );
    })
);

server.registerTool(
  "cz_case_text",
  {
    title: "Czech case law — full text of a decision",
    description:
      "Fetch the full text of a Czech court decision. `court=\"ns\"` takes the 32-character document id from cz_case_search. `court=\"us\"` takes a Constitutional Court case number such as 'I. ÚS 1234/21' or 'Pl. ÚS 19/14'. `court=\"lower\"` takes the UUID or URL from cz_case_lower_scan.",
    inputSchema: {
      court: z.enum(["ns", "us", "lower"]).describe("ns = Nejvyšší soud, us = Ústavní soud, lower = district/regional court"),
      id: z.string().describe("Document id (ns), case number (us), or UUID/URL (lower)"),
      max_chars: z.number().int().min(500).max(400_000).default(60_000),
    },
  },
  async (args) =>
    guard(async () => {
      if (args.court === "ns") {
        const d = await cl.nsText(args.id);
        const h = d.header;
        return text(
          [
            `# ${h.caseNumber || args.id} — Nejvyšší soud`,
            ``,
            h.ecli ? `ECLI: ${h.ecli}` : null,
            `Decided: ${h.decisionDate || "?"} · type: ${h.decisionType || "?"} · category: ${h.category || "?"}`,
            h.keywords ? `Keywords: ${h.keywords}` : null,
            h.provisions ? `Provisions applied: ${h.provisions}` : null,
            ``,
            `Source: ${d.url}`,
            `Retrieved ${todayISO()} from rozhodnuti.nsoud.cz (Nejvyšší soud).`,
            ``,
            `---`,
            ``,
            clamp(d.text, args.max_chars, "Raise max_chars for the rest."),
          ].filter((l) => l !== null).join("\n")
        );
      }
      if (args.court === "us") {
        const d = await cl.usText(args.id);
        return text(
          [
            `# ${d.heading || d.caseNumber} — Ústavní soud`,
            ``,
            `Source: ${d.url}`,
            `Retrieved ${todayISO()} from NALUS (Ústavní soud).`,
            ``,
            `---`,
            ``,
            clamp(d.text, args.max_chars, "Raise max_chars for the rest."),
          ].join("\n")
        );
      }
      const d = await cl.justiceText(args.id);
      return text(
        [
          `# Lower-court decision ${d.uuid}`,
          ``,
          `Text is the official anonymised version published by the Ministry of Justice.`,
          `Source: ${d.url}`,
          `Retrieved ${todayISO()}.`,
          ``,
          `---`,
          ``,
          clamp(d.text, args.max_chars, "Raise max_chars for the rest."),
        ].join("\n")
      );
    })
);

server.registerTool(
  "cz_case_lower_scan",
  {
    title: "Czech case law — scan district and regional court decisions",
    description:
      "Prefer cz_case_lower_search — it covers the whole indexed period at no network cost. Use this scan only for days newer than the index, or to see everything published on a given date. It reads decisions of Czech district and regional courts straight from the Ministry of Justice open-data API and filters them by keyword, cited provision or court. IMPORTANT: this API is indexed by publication date, not by subject — it genuinely walks each day in the range, so keep ranges short (max 31 days) and treat the result as a sample of that window, not an exhaustive search of Czech lower-court case law.",
    inputSchema: {
      date_from: z.string().describe("First publication date to scan (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("Last publication date to scan (YYYY-MM-DD); defaults to date_from"),
      keyword: z.string().optional().describe("Match against subject, index keywords and cited provisions (diacritic-insensitive)"),
      provision: z.string().optional().describe("Match against cited provisions only, e.g. '121/2000'"),
      court: z.string().optional().describe("Match against the court name, e.g. 'Městský soud v Praze'"),
      limit: z.number().int().min(1).max(100).default(25),
    },
  },
  async (args) =>
    guard(async () => {
      const en = args.keyword && englishQueryWarning(args.keyword);
      if (en) return fail(`ERROR: ${en}`);
      const r = await cl.justiceScan(args);
      const header =
        `# Lower-court decisions — ${r.hits.length} match(es)\n\n` +
        `Scanned ${r.scanned} decisions published across ${r.daysScanned} of ${r.daysRequested} requested day(s).\n` +
        (r.failedDays ? `**${r.failedDays} day(s) could not be fetched** — those are gaps in this scan, not days with nothing published.\n` : "") +
        `Source: rozhodnuti.justice.cz open data (Ministry of Justice), retrieved ${todayISO()}.\n` +
        `This is a date-window scan, not a subject index — widen the window or vary the keyword to find more.\n\n`;
      if (!r.hits.length) return text(header + "No decision in that window matched the filters.");
      const lines = r.hits.map(
        (h) =>
          `- **${h.caseNumber}** — ${h.court}\n  ${h.subject || ""}\n` +
          `  decided ${h.decided} · published ${h.published} · ECLI ${h.ecli}\n` +
          (h.keywords.length ? `  keywords: ${h.keywords.join(", ")}\n` : "") +
          (h.provisions.length ? `  provisions: ${h.provisions.join("; ")}\n` : "") +
          `  text: cz_case_text court="lower" id="${h.textUrl.split("/").pop()}"`
      );
      return text(header + lines.join("\n"));
    })
);



server.registerTool(
  "legal_cite",
  {
    title: "Verified citation for a legal reference",
    description:
      "Resolve a loose legal reference into a citation that has been checked against the official text. Accepts Czech statutes ('§ 58 121/2000', '§ 30 autorský zákon'), EU law ('Art. 17 GDPR', 'čl. 6 AI Act', '32016R0679 art 17'), Supreme Court decisions ('23 Cdo 3492/2021') and Constitutional Court decisions ('I. ÚS 1234/21'). Returns the citation in English and Czech, the official URL, a ready-to-paste markdown link, and the wording the provision actually has — so the claim being made about it can be checked in the same step. Use this before putting any citation in a document.",
    inputSchema: {
      reference: z.string().describe("The reference to resolve, e.g. '§ 2898 89/2012' or 'Art. 28 GDPR'"),
      language: z.string().default("en").describe("Language for the EU text and title (en, cs, …)"),
      as_of: z.string().optional()
        .describe("ISO date (YYYY-MM-DD). Quote the wording in force on that date rather than today's — for Czech acts the consolidated version in force then, for EU acts the consolidated text in force then. Use it whenever the facts are historical."),
    },
  },
  async (args) =>
    guard(async () => {
      const r = await cite(args.reference, args.language, { asOf: args.as_of });
      const lines = [
        `# ${r.citation_en}`,
        ``,
        r.warning ? `!! ${r.warning}` : null,
        r.warning ? `` : null,
        `**English:** ${r.citation_en}`,
        `**Czech:** ${r.citation_cs}`,
        `**Markdown (paste into a draft — becomes a live hyperlink in Google Docs):**`,
        "```",
        r.markdown,
        "```",
        r.as_of ? `**As of ${r.as_of}** — wording below is the version in force on that date, not today's.` : null,
        r.version_basis ? `Version used: ${r.text_from_celex} — ${r.version_basis}` : null,
        r.url ? `Official source: ${r.url}` : null,
        r.eli ? `ELI: ${r.eli}` : null,
        r.version_in_force_from ? `Version read: in force from ${r.version_in_force_from}${r.version_in_force_to ? ` to ${r.version_in_force_to}` : ""}` : null,
        r.in_force === false ? `In force: NO` : r.in_force === true ? `In force: yes${r.entry_into_force ? ` (since ${r.entry_into_force})` : ""}` : null,
        r.category ? `Publication category: ${r.category}` : null,
        r.keywords ? `Keywords: ${r.keywords}` : null,
        r.provisions ? `Provisions applied: ${r.provisions}` : null,
        ``,
        r.verified_text ? `## Wording as published\n\n${clamp(r.verified_text, 12000)}` : `(No provision-level text pulled — the reference names a whole instrument. Add an article or § to verify specific wording.)`,
        ``,
        `Retrieved ${r.retrieved}.`,
      ].filter((l) => l !== null);
      return text(lines.join("\n"));
    })
);


/* --------------------------------------- ÚOOÚ guidance (Czech DPA) */

server.registerTool(
  "cz_guidance_search",
  {
    title: "ÚOOÚ guidance — search",
    description:
      "Search the guidance, opinions, FAQs and enforcement announcements of ÚOOÚ, the Czech data protection authority, from a local full-text index of everything it has published since 2017. This is where a GDPR question that the Regulation leaves open is usually settled in practice. Query in Czech — the index handles Czech inflection and diacritics. Returns matching documents with the passage that matched.",
    inputSchema: {
      query: z.string().describe("Czech search terms, e.g. 'oprávněný zájem marketing', 'kamerový systém', 'pokuta za spam'"),
      from: z.string().optional().describe("Only documents published on or after this ISO date"),
      to: z.string().optional().describe("Only documents published on or before this ISO date"),
      kind: z.enum(["article", "page"]).optional().describe("'article' for published items, 'page' for the standing explanatory pages"),
      limit: z.number().int().min(1).max(50).default(10),
    },
  },
  async (args) =>
    guard(async () => {
      if (!uoou.dbExists()) {
        return fail(
          "ERROR: the ÚOOÚ index has not been built. Run `node tools/uoou-index.mjs build` from the project root — " +
            "it takes a few seconds and fetches the authority's whole published corpus."
        );
      }
      const en = englishQueryWarning(args.query);
      if (en) return fail(`ERROR: ${en}`);
      const r = uoou.search(args);
      const age = r.builtAt ? Math.floor((Date.now() - Date.parse(r.builtAt)) / 86_400_000) : null;
      const header =
        `# ÚOOÚ guidance — ${r.rows.length} result(s) for "${args.query}"\n\n` +
        `Matched on: ${r.matched}. Index holds ${r.corpus} documents` +
        (age !== null ? `, built ${age} day(s) ago` : "") + ".\n" +
        (age !== null && age > 30 ? `Index is over a month old — rebuild with \`node tools/uoou-index.mjs build\`.\n` : "") +
        `Source: uoou.gov.cz (Úřad pro ochranu osobních údajů). Guidance is the regulator's view, not binding law — cite it as such.\n\n`;
      if (!r.rows.length) {
        return text(header + "Nothing matched. Try fewer or different Czech terms — the index searches the authority's own wording.");
      }
      const lines = r.rows.map(
        (x) =>
          `- **${x.title}**${x.published ? ` (${x.published})` : ""}${x.flag ? ` · ${uoou.flagName(x.flag)}` : ""}\n` +
          (x.perex ? `  ${x.perex.slice(0, 220)}\n` : "") +
          (x.snip ? `  …${x.snip.replace(/\n/g, " ")}…\n` : "") +
          `  ${x.url}\n  full text: cz_guidance_text id=${x.id}`
      );
      return text(header + lines.join("\n\n"));
    })
);

server.registerTool(
  "cz_guidance_text",
  {
    title: "ÚOOÚ guidance — full text",
    description:
      "Full text of one ÚOOÚ document, by the id returned from cz_guidance_search or by its URL. Read this before relying on what the authority said — the search snippet is not the position.",
    inputSchema: {
      id: z.union([z.number().int(), z.string()]).describe("Document id from cz_guidance_search, or the uoou.gov.cz URL"),
      max_chars: z.number().int().min(500).max(200_000).default(40_000),
    },
  },
  async (args) =>
    guard(async () => {
      const d = uoou.get(args.id);
      return text(
        [
          `# ${d.title}`,
          ``,
          d.published ? `Published ${d.published}${d.updated && d.updated !== d.published ? ` · updated ${d.updated}` : ""}` : `Standing page (no publication date)`,
          d.flag ? `Type: ${uoou.flagName(d.flag)}` : null,
          `Source: ${d.url}`,
          ``,
          `This is guidance from ÚOOÚ — the supervisory authority's interpretation. It is persuasive, not binding: cite it as the regulator's position and check the underlying provision with legal_cite.`,
          ``,
          `---`,
          ``,
          d.perex ? `**${d.perex}**\n` : "",
          clamp(d.body || "(no body text stored)", args.max_chars, "Raise max_chars for the rest."),
        ].filter((l) => l !== null).join("\n")
      );
    })
);


/* ------------------------------ Constitutional Court (NALUS) search */

server.registerTool(
  "cz_us_search",
  {
    title: "Constitutional Court — search",
    description:
      "Search decisions of the Ústavní soud by full text, ECLI, case number or decision date. `text` searches the entire decision, which is how to find decisions on a subject. Results carry the ECLI, the parties and subject of proceedings, the provisions the decision turns on, its form (nález / usnesení) and outcome. Query in Czech — cz_us_keywords gives the court's own index vocabulary to phrase it with.",
    inputSchema: {
      text: z.string().optional().describe("Words appearing anywhere in the decision, e.g. 'autorské dílo'"),
      case_number: z.string().optional().describe("Case number, e.g. 'I. ÚS 1234/21'"),
      ecli: z.string().optional().describe("ECLI, e.g. 'ECLI:CZ:US:2021:1.US.1234.21.1'"),
      decided_from: z.string().optional().describe("Decided on or after this ISO date"),
      decided_to: z.string().optional().describe("Decided on or before this ISO date"),
      page: z.number().int().min(0).default(0).describe("0-based results page"),
      page_size: z.number().int().min(5).max(100).default(20),
    },
  },
  async (args) =>
    guard(async () => {
      if (args.text) {
        const en = englishQueryWarning(args.text);
        if (en) return fail(`ERROR: ${en}`);
      }
      const r = await nalus.search(args);
      if (!r.items.length) {
        return text(
          `No Constitutional Court decision matched (criteria: ${r.criteria.join(", ")}).\n\n` +
            `Full-text search is on the court's Czech wording — try the court's own index terms via cz_us_keywords.`
        );
      }
      const lines = r.items.map(
        (i) =>
          `- **${i.caseNumber}**${i.form ? ` · ${i.form}` : ""}${i.verdict ? ` · ${i.verdict}` : ""}\n` +
          (i.ecli ? `  ${i.ecli}\n` : "") +
          (i.party_and_subject ? `  ${i.party_and_subject}\n` : "") +
          (i.dates ? `  dates: ${i.dates}\n` : "") +
          (i.provisions ? `  provisions: ${i.provisions.slice(0, 220)}\n` : "") +
          `  full text: cz_case_text court="us" id="${i.caseNumber}"`
      );
      return text(
        `# Ústavní soud — ${r.items.length} shown${r.total != null ? ` of ${r.total} matching` : ""}\n\n` +
          `Criteria: ${r.criteria.join(", ")}. Source: nalus.usoud.cz, retrieved ${todayISO()}.\n` +
          `A *nález* decides on the merits and binds; a *usnesení* is usually a rejection and carries far less weight.\n\n` +
          lines.join("\n\n") +
          (r.total != null && r.total > (r.page + 1) * (args.page_size || 20)
            ? `\n\nMore results: repeat with page=${r.page + 1}.`
            : "")
      );
    })
);

server.registerTool(
  "cz_us_keywords",
  {
    title: "Constitutional Court — subject index vocabulary",
    description:
      "The Constitutional Court's own controlled subject index (věcný rejstřík) — around 500 Czech terms. Use it to turn a concept into the exact wording the court uses before running cz_us_search, rather than guessing a Czech phrase. Pass a fragment to filter, or nothing to list everything.",
    inputSchema: {
      filter: z.string().optional().describe("Fragment to filter by, diacritic-insensitive, e.g. 'autor', 'osobní'"),
    },
  },
  async (args) =>
    guard(async () => {
      const terms = await nalus.keywords(args.filter);
      if (!terms.length) {
        return text(`No index term contains "${args.filter}". Call with no filter to see all ${(await nalus.keywords()).length} terms.`);
      }
      return text(
        `# Ústavní soud subject index — ${terms.length} term(s)${args.filter ? ` matching "${args.filter}"` : ""}\n\n` +
          `These are the court's own vocabulary. Put them into cz_us_search \`text\` to search the way the court writes.\n\n` +
          terms.map((t) => `- ${t}`).join("\n")
      );
    })
);

server.registerTool(
  "cz_case_lower_search",
  {
    title: "District and regional courts — subject search",
    description:
      "Search district and regional court decisions by subject, index keywords and the provisions cited, from a local index of the Ministry of Justice open data. Query in Czech. Unlike cz_case_lower_scan (which walks a date window), this searches everything that has been indexed — check the coverage line in the result, because the index only holds the date range that was built.",
    inputSchema: {
      query: z.string().describe("Czech terms matched against subject, keywords and cited provisions"),
      court: z.string().optional().describe("Restrict to a court, e.g. 'Městský soud v Praze'"),
      provision: z.string().optional().describe("Restrict to decisions citing this, e.g. '89/2012' or '121/2000'"),
      from: z.string().optional().describe("Decided on or after this ISO date"),
      to: z.string().optional().describe("Decided on or before this ISO date"),
      limit: z.number().int().min(1).max(50).default(15),
    },
  },
  async (args) =>
    guard(async () => {
      if (!justice.dbExists()) {
        return fail(
          "ERROR: the lower-court index has not been built. Run `node tools/justice-index.mjs build --from 2025-01-01` " +
            "from the project root — about four API calls per publication day, and resumable."
        );
      }
      const en = englishQueryWarning(args.query);
      if (en) return fail(`ERROR: ${en}`);
      const r = justice.search(args);
      const header =
        `# District and regional courts — ${r.rows.length} result(s) for "${args.query}"\n\n` +
        `Matched on: ${r.matched}. Index holds ${r.corpus} decisions from ${r.coverage.n} publication days ` +
        `(${r.coverage.a} → ${r.coverage.b}).\n` +
        `**Coverage is limited on two axes, not one.**\n` +
        `  Dates: only what has been indexed. Anything published outside that window is invisible here, ` +
        `not absent from the case law. Widen it with \`node tools/justice-index.mjs build --from …\`.\n` +
        `  Agenda: registers held are ${r.dockets.map((d) => `${d.reg} (${d.n})`).join(", ") || "unknown"}. ` +
        `The Ministry of Justice feed carries the ordinary courts' civil and criminal dockets and **no ` +
        `administrative justice (správní soudnictví)**. For judicial review of an administrative decision — ` +
        `environmental permits and penalties, tax, building, asylum — search \`cz_nss_search\` instead, which ` +
        `covers the Supreme Administrative Court and the regional courts sitting in their administrative agenda.\n` +
        `These are first- and second-instance decisions: persuasive at most, and often superseded on appeal.\n\n`;
      if (!r.rows.length) return text(header + "Nothing matched in the indexed range.");
      const lines = r.rows.map(
        (x) =>
          `- **${x.case_number || "?"}** — ${x.court || "?"}${x.decided ? ` (${x.decided})` : ""}\n` +
          (x.subject ? `  ${x.subject}\n` : "") +
          (x.keywords ? `  keywords: ${x.keywords.slice(0, 160)}\n` : "") +
          (x.provisions ? `  provisions: ${x.provisions.slice(0, 160)}\n` : "") +
          `  ${x.ecli}\n  full text: cz_case_text court="lower" id="${x.uuid}"`
      );
      return text(header + lines.join("\n\n"));
    })
);


/* -------------------------------- Court of Justice of the European Union */

server.registerTool(
  "eu_case_search",
  {
    title: "CJEU case law — search",
    description:
      "Search case law of the Court of Justice of the European Union and the General Court by words in the title, which for these judgments carries both the parties and the subject-matter keywords. Sourced from CELLAR, the Publications Office's own repository, so the texts are official. curia.europa.eu has no API and is not used. Returns one row per case with its CELEX number, which eu_act_text or legal_cite will then resolve to full text.",
    inputSchema: {
      query: z.string().describe("Words in the case title, e.g. 'personal data third country transfer' or a party name"),
      court: z.enum(["C", "T"]).optional().describe("C = Court of Justice, T = General Court. Omit for both."),
      doc_type: z.enum(["CJ", "TJ", "CC", "CO", "TO", "CV"]).optional()
        .describe("CJ/TJ judgment, CC Opinion of the Advocate General, CO/TO order, CV Opinion of the Court"),
      from: z.string().optional().describe("Decided on or after this ISO date"),
      to: z.string().optional().describe("Decided on or before this ISO date"),
      language: z.string().default("en"),
      limit: z.number().int().min(1).max(50).default(20),
    },
  },
  async (args) =>
    guard(async () => {
      const rows = await cjeu.search({ ...args, docType: args.doc_type });
      if (!rows.length) {
        return text(
          `No CJEU case matched "${args.query}". The search is on the case title, which contains the parties and the ` +
            `subject-matter keywords, so try the words the Court itself would use, or a party name.`
        );
      }
      const lines = rows.map(
        (r) =>
          `- **Case ${r.caseNumber}** — ${r.description}${r.date ? `, ${r.date}` : ""}\n` +
          `  ${r.title}\n  CELEX ${r.celex} · ${r.url}\n  full text: legal_cite reference="${r.caseNumber}"`
      );
      return text(
        `# CJEU case law — ${rows.length} case(s) for "${args.query}"\n\n` +
          `Source: CELLAR (Publications Office of the EU), retrieved ${todayISO()}. One row per case; ` +
          `summary notices and restatements are collapsed onto the substantive document.\n\n` +
          lines.join("\n\n")
      );
    })
);

server.registerTool(
  "eu_case_documents",
  {
    title: "CJEU case — what documents exist",
    description:
      "Given a CJEU case number such as 'C-311/18' or 'T-604/18', list every document CELLAR holds for it: the judgment, the Opinion of the Advocate General, any order, the original request for a preliminary ruling and the Official Journal summary. Use it to find the Advocate General's Opinion, which is often the fuller reasoning, or to check whether a case has been decided yet.",
    inputSchema: {
      case_number: z.string().describe("e.g. 'C-311/18', 'T-604/18', 'C-6/64'"),
      language: z.string().default("en"),
    },
  },
  async (args) =>
    guard(async () => {
      const r = await cjeu.documentsFor(args.case_number, args.language);
      const lines = r.documents.map(
        (d) => `- **${d.celex}** — ${d.description}${d.date ? `, ${d.date}` : ""}\n  ${d.title || ""}\n  ${d.url}`
      );
      return text(
        `# Case ${r.case.caseNumber} — ${r.documents.length} document(s) in CELLAR\n\n` +
          `Note the CELEX year is the year the case was **lodged** (${r.case.year}), not the year it was decided.\n` +
          `Case page at the Court: ${r.curia}\n` +
          `Retrieved ${todayISO()}.\n\n` +
          lines.join("\n\n") +
          `\n\nFull text of any of these: eu_act_text with the CELEX, or legal_cite reference="${r.case.caseNumber}".`
      );
    })
);

/* ------------------ Supreme Administrative Court and regional administrative
 *                    courts (vyhledavac.nssoud.cz)                          */

server.registerTool(
  "cz_nss_areas",
  {
    title: "NSS — the court's own subject index",
    description:
      "The controlled vocabularies of the Nejvyšší správní soud (Supreme Administrative Court) search: the subject areas (Oblast úpravy) it classifies every decision under, and the courts and senates it indexes. Use it to turn a concept into the court's own wording before running cz_nss_search, the way cz_us_keywords works for the Constitutional Court. Pass a fragment to filter.",
    inputSchema: {
      filter: z.string().optional()
        .describe("Fragment to filter by, diacritic-insensitive, e.g. 'životní', 'vod', 'krajský'"),
      kind: z.enum(["areas", "courts", "registers"]).default("areas")
        .describe("'areas' = subject index, 'courts' = courts and senates, 'registers' = case registers (As, Afs, Azs …)"),
      refresh: z.boolean().default(false).describe("Re-fetch the vocabularies from the court rather than using the cached copy."),
    },
  },
  async (args) =>
    guard(async () => {
      const vocab = await nss.vocabulary({ refresh: args.refresh });
      const all = vocab[args.kind] || [];
      const f = String(args.filter || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const hits = f
        ? all.filter((e) => e.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(f))
        : all;
      const label = { areas: "subject areas (Oblast úpravy)", courts: "courts and senates", registers: "case registers" }[args.kind];
      if (!hits.length) {
        return text(
          `# NSS ${label} — nothing matches "${args.filter}"\n\n` +
            `${all.length} terms are available. Run without a filter to list them all.`
        );
      }
      return text(
        `# NSS ${label} — ${hits.length} of ${all.length} term(s)${args.filter ? ` matching "${args.filter}"` : ""}\n\n` +
          `These are the court's own vocabulary. Pass one to cz_nss_search as \`area\` (or \`court\`) ` +
          `rather than guessing a Czech phrase.\n` +
          `Source: ${nss.SITE}, vocabularies cached ${String(vocab.fetched_at).slice(0, 10)}.\n\n` +
          hits.map((e) => `- ${e.title}  [id ${e.id}]`).join("\n")
      );
    })
);

server.registerTool(
  "cz_nss_search",
  {
    title: "Supreme Administrative Court and regional administrative courts — search",
    description:
      "Search the Nejvyšší správní soud (Supreme Administrative Court, NSS) and the regional courts sitting in their administrative agenda, through the court's own search engine. **This is the case law for any question of Czech administrative law — environmental permits and penalties, tax, building, asylum, public procurement — none of which appears in cz_case_lower_search, whose Ministry of Justice feed carries the civil and criminal dockets only.** Criteria are ANDed. `text` reaches the court's full-text engine, which lemmatises Czech, so pass the base form and do not enumerate inflections. `area` takes a term from cz_nss_areas. `provision` finds every decision that applied a given section of a given act.",
    inputSchema: {
      text: z.string().optional()
        .describe("Czech words to find in the decision text, e.g. 'kácení dřevin', 'závazné stanovisko'. Lemmatised by the court's engine."),
      area: z.union([z.string(), z.array(z.string())]).optional()
        .describe("Subject area(s) from cz_nss_areas, e.g. 'Životní prostředí - ochrana přírody a krajiny'. Several widen the search."),
      court: z.string().optional()
        .describe("Court or senate from cz_nss_areas kind='courts', e.g. 'Nejvyšší správní soud', 'rozšířený senát NSS', 'Krajský soud v Brně'."),
      case_number: z.string().optional().describe("Case number, e.g. '10 As 198/2025'"),
      provision: z
        .object({
          article: z.string().optional().describe("čl., for constitutional acts and treaties"),
          section: z.string().optional().describe("§, e.g. '56'"),
          paragraph: z.string().optional().describe("odst., e.g. '1'"),
          letter: z.string().optional().describe("písm., e.g. 'a'"),
          kind: z.enum(["zákona", "nařízení", "vyhlášky"]).default("zákona"),
          number: z.union([z.number().int(), z.string()]).describe("Act number, e.g. 114"),
          year: z.union([z.number().int(), z.string()]).describe("Act year, e.g. 1992"),
        })
        .optional()
        .describe("Decisions that applied this provision, e.g. {section:'56', number:114, year:1992}."),
      decided_from: z.string().optional().describe("Decided on or after this ISO date"),
      decided_to: z.string().optional().describe("Decided on or before this ISO date"),
      published_from: z.string().optional().describe("Released on or after this ISO date"),
      published_to: z.string().optional().describe("Released on or before this ISO date"),
      limit: z.number().int().min(1).max(40).default(20),
    },
  },
  async (args) =>
    guard(async () => {
      if (args.text) {
        const en = englishQueryWarning(args.text);
        if (en) return fail(`ERROR: ${en}`);
      }
      const r = await nss.search(args);
      const header =
        `# Nejvyšší správní soud and regional administrative courts — ${r.shown} shown of ${r.total} matching\n\n` +
        `Criteria: ${r.criteria.join(" AND ")}.\n` +
        `Source: ${nss.SITE} (the court's own search), retrieved ${todayISO()}.\n` +
        `A decision published in the **Sbírka rozhodnutí NSS** carries the most weight; cz_nss_case reports ` +
        `whether a given one is. Regional court judgments here are first-instance administrative rulings and ` +
        `may have been set aside on cassation.\n\n`;
      if (!r.rows.length) {
        return text(
          header +
            `No decision matched. These criteria against this source found nothing, which is not the same as ` +
            `there being no such case law: try the subject area on its own first (cz_nss_areas lists them), ` +
            `then narrow.`
        );
      }
      const clean = (v) => (v && v !== "&nbsp" && v !== "&nbsp;" ? v : null);
      const lines = r.rows.map((x) => {
        const bits = [
          `- **${x.case_number || "?"}** — ${clean(x.court) || "?"}${x.decided ? ` (${x.decided})` : ""}`,
          clean(x.doc_type) || clean(x.outcome) ? `  ${[clean(x.doc_type), clean(x.outcome)].filter(Boolean).join(" · ")}` : null,
          clean(x.parties) ? `  parties: ${x.parties}` : null,
          clean(x.legal_thesis) ? `  legal thesis: ${x.legal_thesis.slice(0, 300)}` : null,
          x.citation ? `  cite as: ${x.citation}` : null,
          `  record: cz_nss_case id="${x.id}" · full text: cz_nss_text id="${x.id}"`,
        ];
        return bits.filter(Boolean).join("\n");
      });
      const more = r.total > r.shown ? `\n\n${r.total - r.shown} further decisions matched and are not listed. Narrow with a date range, a court, or a subject area.` : "";
      return text(header + lines.join("\n\n") + more);
    })
);

server.registerTool(
  "cz_nss_case",
  {
    title: "NSS decision — the full record",
    description:
      "The document record for one decision of the Supreme Administrative Court or a regional administrative court: ECLI, rapporteur, whether it is published in the Sbírka rozhodnutí NSS (the weight indicator), the subject area, whether EU law was applied, every provision the decision applied, the precedents it relies on with how it treats them, the parties and their procedural roles, the administrative decision challenged, and the regional court judgment under cassation. Ids come from cz_nss_search.",
    inputSchema: { id: z.union([z.string(), z.number().int()]).describe("Document id from cz_nss_search, e.g. '784852'") },
  },
  async (args) =>
    guard(async () => {
      const d = await nss.detail(args.id);
      const row = (label, value) => (value ? `- **${label}:** ${value}` : null);
      const sb = d.published_in_collection;
      const lines = [
        `# ${d.ecli || `NSS document ${d.id}`}`,
        ``,
        `Source: ${d.url}, retrieved ${todayISO()}.`,
        ``,
        row("Court", d.court),
        row("Document type", d.doc_type),
        row("Type of proceedings", d.proceeding_type),
        row("Outcome", d.outcome),
        row("Decided", d.decided),
        row("Final (právní moc)", d.final_on),
        row("Released", d.released),
        row("Rapporteur", d.rapporteur),
        row("Subject area", d.area),
        row("EU law applied", d.eu_law_applied),
        sb
          ? `- **Published in Sbírka rozhodnutí NSS:** ${sb}${/^ne$/i.test(sb) ? "  (so it is an ordinary decision, persuasive but not collection authority)" : "  (collection authority — the strongest weight NSS decisions carry)"}`
          : null,
        row("Has a formulated legal thesis (právní věta)", d.has_legal_thesis),
        ``,
        d.provisions?.length
          ? `## Provisions applied\n\n${d.provisions.map((p) => `- ${p.citation || `${p.section || "?"} of ${p.act || "?"}`}`).join("\n")}\n\nQuote any of these through \`legal_cite\` before citing it.`
          : null,
        d.under_review
          ? `## Administrative decision challenged\n\n- ${d.under_review.authority}${d.under_review.reference ? `, ref. ${d.under_review.reference}` : ""}${d.under_review.dated ? `, ${d.under_review.dated}` : ""}`
          : null,
        d.court_below
          ? `## Judgment under cassation\n\n- ${d.court_below.court}, ${d.court_below.case_number || "?"}${d.court_below.decided ? `, ${d.court_below.decided}` : ""}${d.court_below.outcome_on_cassation ? ` — NSS: ${d.court_below.outcome_on_cassation}` : ""}`
          : null,
        d.precedents?.length
          ? `## Precedents relied on\n\n${d.precedents
              .map((p) => `- ${p.case_number}${p.court ? ` (${p.court})` : ""}${p.collection ? ` — ${p.collection}` : ""}${p.weight ? ` · ${p.weight}` : ""}${p.treatment ? ` · ${p.treatment}` : ""}`)
              .join("\n")}`
          : null,
        d.parties?.length
          ? `## Parties\n\n${d.parties.map((p) => `- ${p.name} — ${p.role}`).join("\n")}`
          : null,
        ``,
        `Full text: cz_nss_text id="${d.id}"`,
      ];
      return text(lines.filter((l) => l !== null).join("\n"));
    })
);

server.registerTool(
  "cz_nss_text",
  {
    title: "NSS decision — full text",
    description:
      "The full official text of a decision of the Supreme Administrative Court or a regional administrative court, including the reasoning. Ids come from cz_nss_search. Read the passage before citing the decision for a proposition: a search matches words, not holdings.",
    inputSchema: {
      id: z.union([z.string(), z.number().int()]).describe("Document id from cz_nss_search, e.g. '784852'"),
      max_chars: z.number().int().min(500).max(400_000).default(80_000)
        .describe("Hard cap on returned characters; any cut is marked explicitly."),
    },
  },
  async (args) =>
    guard(async () => {
      const d = await nss.fulltext(args.id);
      return text(
        `# NSS document ${d.id} — full text\n\n` +
          `Official text: ${d.url}\nRetrieved ${d.retrieved} from ${nss.SITE}.\n` +
          `Record (ECLI, provisions applied, precedents): cz_nss_case id="${d.id}"\n\n---\n\n` +
          clamp(d.text, args.max_chars, `Narrow with a higher max_chars, or read the official text at ${d.url}.`)
      );
    })
);

/* ------------------------ MŽP guidance (Ministry of the Environment) */

server.registerTool(
  "cz_mzp_search",
  {
    title: "MŽP guidance and Věstník — search",
    description:
      "Search the Věstník MŽP and the methodological documents of the Ministerstvo životního prostředí (Czech Ministry of the Environment), from a local full-text index including the text of the PDFs. For a Czech environmental question this is often what settles how a provision is applied in practice, the way ÚOOÚ guidance settles a GDPR question. Publication in the Věstník is a condition of validity for the resort instruments it carries, so it is also the place to check whether an instruction is in force. Query in Czech. **None of it is binding law**: a methodological instruction binds subordinate authorities administratively and a court may depart from it, so always pair a result with the provision it interprets via legal_cite.",
    inputSchema: {
      query: z.string().describe("Czech search terms, e.g. 'kácení dřevin náhradní výsadba', 'ekologická újma', 'hluk'"),
      kind: z.enum(["vestnik", "dokument", "agenda", "metodika", "legislativa", "smlouvy", "katalog", "informace"]).optional()
        .describe("'vestnik' = an issue of the Věstník MŽP, 'dokument' = a file attached to a ministry page, the rest are page types"),
      year: z.number().int().optional().describe("Restrict to Věstník files of this year"),
      from: z.string().optional().describe("Published on or after this ISO date"),
      to: z.string().optional().describe("Published on or before this ISO date"),
      limit: z.number().int().min(1).max(50).default(10),
    },
  },
  async (args) =>
    guard(async () => {
      const en = englishQueryWarning(args.query);
      if (en) return fail(`ERROR: ${en}`);
      const r = mzp.search(args);
      const stale = r.ageDays !== null && r.ageDays > 90
        ? `\n**The index is ${r.ageDays} days old.** Rebuild with \`node tools/mzp-index.mjs build\` before relying on it for anything current.`
        : "";
      const header =
        `# MŽP guidance — ${r.rows.length} result(s) for "${args.query}"\n\n` +
        `Matched on: ${r.matched}. Index holds ${r.corpus} documents from ${mzp.SITE_URL}, built ` +
        `${r.builtAt ? String(r.builtAt).slice(0, 10) : "unknown"}.${stale}\n` +
        (r.pdfText ? "" : "\n**PDF text was not extracted when this index was built**, so files match on title only. Install poppler and rebuild.\n") +
        (r.noText ? `${r.noText} document(s) in the index have no extractable text and match on title alone.\n` : "") +
        `\n**This is the ministry's interpretation, not the rule.** A metodický pokyn binds subordinate ` +
        `authorities administratively; it is not law and a court may depart from it. Cite it as the ` +
        `ministry's position and pair it with the provision it construes (\`legal_cite\`). Publication in ` +
        `the Věstník is, however, a condition of validity for the resort instruments it carries.\n\n`;
      if (!r.rows.length) {
        return text(
          header +
            `Nothing matched. These Czech terms against this index found nothing, which is not the same as ` +
            `the ministry having said nothing: try fewer or different Czech terms, and check the index is current.`
        );
      }
      const lines = r.rows.map((x) => {
        const when = x.published || (x.year ? `${x.year}` : null);
        return (
          `- **${x.title}**${when ? ` (${when})` : ""}${x.format && x.format !== "html" ? ` · ${x.format.toUpperCase()}` : ""}\n` +
          (x.section ? `  section: ${x.section}\n` : "") +
          (x.snip ? `  ${x.snip.replace(/\s+/g, " ").slice(0, 400)}\n` : "") +
          `  ${x.url}\n` +
          (x.parent_url ? `  linked from: ${x.parent_url}\n` : "") +
          `  full text: cz_mzp_text id="${x.id}"`
        );
      });
      return text(header + lines.join("\n\n"));
    })
);

server.registerTool(
  "cz_mzp_text",
  {
    title: "MŽP guidance — full document",
    description:
      "The full text of one Věstník MŽP issue or ministry methodological document from the local index, with its source URL and the date it was fetched. Ids come from cz_mzp_search. Read the passage before relying on it: a search matches words, not the ministry's actual position.",
    inputSchema: {
      id: z.union([z.string(), z.number().int()]).describe("Document id from cz_mzp_search, or the document URL"),
      max_chars: z.number().int().min(500).max(400_000).default(60_000)
        .describe("Hard cap on returned characters; any cut is marked explicitly."),
    },
  },
  async (args) =>
    guard(async () => {
      const d = mzp.get(args.id);
      const head =
        `# ${d.title}\n\n` +
        `Kind: ${d.kind}${d.format && d.format !== "html" ? ` · ${d.format.toUpperCase()}` : ""}` +
        `${d.year ? ` · ${d.year}` : ""}${d.published ? ` · published ${d.published}` : ""}\n` +
        `Official source: ${d.url}\n` +
        (d.parent_url ? `Linked from: ${d.parent_url}\n` : "") +
        `Mirrored ${String(d.fetched_at || "").slice(0, 10)} from ${mzp.SITE_URL}.\n\n` +
        `**The ministry's interpretation, not the rule.** Cite it as the ministry's position and pair it ` +
        `with the provision it construes.\n\n---\n\n`;
      if (!d.body || d.body.length < 200) {
        return text(
          head +
            `No text was extracted for this document. Read it at the official source above.` +
            (d.format && d.format !== "pdf" ? ` It is a ${d.format.toUpperCase()} file, which this index does not extract.` : "")
        );
      }
      return text(head + clamp(d.body, args.max_chars, `Read the rest at ${d.url}.`));
    })
);

const transport = new StdioServerTransport();
await server.connect(transport);
