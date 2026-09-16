/**
 * Turn a loose legal reference into a verified citation.
 *
 * The point is not formatting — it is that the citation is checked against the
 * official text before it is written down. Every result carries the wording the
 * provision actually has, so a claim about it can be checked in the same breath.
 */
import * as cz from "./esbirka.js";
import * as eu from "./eurlex.js";
import * as cl from "./caselaw.js";
import * as cjeu from "./cjeu.js";
import { resolveCzAlias, resolveEuAlias } from "./aliases.js";
import { todayISO } from "./http.js";

const SECTION_RE = /§\s*(\d+[a-z]*)/i;
const ACT_RE = /(\d{1,3})\s*\/\s*(\d{4})/;
// `\b` is ASCII-only in JS, so it never fires before "čl." — match on a
// non-letter boundary with the unicode flag instead.
const ARTICLE_RE = /(?:^|[^\p{L}])(?:art|article|čl|článek)\.?\s*(\d+[a-z]*)/iu;
const US_CASE_RE = /\b(Pl|I{1,3}|IV)\s*\.?\s*ÚS\s*\d+\s*\/\s*\d{2,4}/i;
const NS_CASE_RE = /\b\d+\s+[A-Za-zČčŘřŠšŽžÝýÁáÉéÍíÓóÚúŮů]{2,5}\s+\d+\s*\/\s*\d{4}\b/;
const CELEX_RE = /\b([0-9]{5}[A-Z]{1,2}[0-9]{4}(?:-[0-9]{8})?)\b/;
// Checked before the Czech act pattern: "C-311/2018" would otherwise parse as act 311/2018.
const CJEU_CASE_RE = /\b(C|T|F)[-\u2011]\s?(\d{1,4})\/(\d{2}|\d{4})\b/i;

const mdLink = (label, url) => `[${label}](${url})`;

/** Drop the database page chrome that precedes the decision itself. */
function trimToHeading(text, heading) {
  if (!heading) return text;
  const i = text.indexOf(heading);
  return i > 0 ? text.slice(i) : text;
}

/** Strip the alias name out so the numeric parse does not trip over it. */
function czRefFrom(input) {
  const act = input.match(ACT_RE);
  if (act) return { number: act[1], year: act[2] };
  const alias = resolveCzAlias(input.replace(SECTION_RE, "").trim());
  return alias || null;
}

/**
 * Pick the EU text that was actually in force.
 *
 * A CELEX beginning "3" is the act *as adopted* — for an amended instrument that
 * is superseded wording. CELLAR publishes consolidated texts as "0…-YYYYMMDD".
 * Default to the newest consolidation; with `asOf`, take the one in force then.
 */
async function resolveEuVersion(celex, asOf) {
  const c = eu.normalizeCelex(celex);
  if (c.startsWith("0") && c.includes("-")) {
    return { celex: c, basis: `consolidated text as given (${c.split("-")[1].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")})` };
  }
  let versions = [];
  try {
    versions = await eu.consolidatedVersions(c);
  } catch {
    return { celex: c, basis: "as adopted — could not check for consolidated versions", uncertain: true };
  }
  if (!versions.length) {
    return { celex: c, basis: "as adopted; CELLAR records no consolidated version, so the act has not been amended" };
  }
  const pick = asOf ? versions.find((v) => v.consolidatedAt && v.consolidatedAt <= asOf) : versions[0];
  if (!pick) {
    return {
      celex: c,
      basis: `as adopted — the earliest consolidation (${versions[versions.length - 1].consolidatedAt}) is later than ${asOf}`,
    };
  }
  return {
    celex: pick.celex,
    fallbacks: versions.filter((v) => v.celex !== pick.celex).map((v) => v.celex),
    basis: asOf
      ? `consolidated as at ${pick.consolidatedAt}, the version in force on ${asOf}`
      : `consolidated as at ${pick.consolidatedAt}, the newest consolidation`,
    consolidatedAt: pick.consolidatedAt,
    supersedes: c,
    others: versions.length,
  };
}

/**
 * @param {string} input      the reference to resolve
 * @param {string} language   language for EU text and titles
 * @param {{asOf?: string}} opts  ISO date; quote the text in force on that date
 */
export async function cite(input, language = "en", opts = {}) {
  const asOf = opts.asOf || null;
  if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error(`as_of must be an ISO date (YYYY-MM-DD), got "${asOf}".`);
  }
  const raw = String(input).trim();
  if (!raw) throw new Error("legal_cite needs a reference to resolve.");

  // --- Court of Justice of the European Union -------------------------------
  const cjeuHit = raw.match(CJEU_CASE_RE);
  if (cjeuHit) {
    const found = await cjeu.documentsFor(cjeuHit[0], language);
    const main = found.documents[0];
    const body = await eu.fetchText(main.celex, language);
    const label = `Case ${found.case.caseNumber}`;
    return {
      kind: "eu_case",
      court: main.type.startsWith("T") ? "General Court" : "Court of Justice of the European Union",
      celex: main.celex,
      citation_en: `${label}, ${main.description}${main.date ? ` of ${main.date}` : ""} (CELEX ${main.celex})`,
      citation_cs: `věc ${found.case.caseNumber}, ${main.description}${main.date ? ` ze dne ${main.date}` : ""} (CELEX ${main.celex})`,
      title: main.title,
      url: main.url,
      curia_url: found.curia,
      markdown: mdLink(label, main.url),
      other_documents: found.documents.slice(1).map((d) => `${d.celex} (${d.description})`),
      verified_text: body.text,
      retrieved: todayISO(),
    };
  }

  // --- Constitutional Court -------------------------------------------------
  const usHit = raw.match(US_CASE_RE);
  if (usHit) {
    const d = await cl.usText(usHit[0]);
    const label = d.heading?.split(/\s+ze dne/)[0]?.trim() || usHit[0];
    return {
      kind: "case",
      court: "Ústavní soud",
      citation_en: `Constitutional Court, ${label}`,
      citation_cs: `nález/usnesení Ústavního soudu sp. zn. ${label}`,
      url: d.url,
      markdown: mdLink(label, d.url),
      verified_text: trimToHeading(d.text, d.heading),
      retrieved: todayISO(),
    };
  }

  // --- Supreme Court --------------------------------------------------------
  const nsHit = raw.match(NS_CASE_RE);
  if (nsHit) {
    const found = await cl.nsSearch({ case_number: nsHit[0].replace(/\s*\/\s*/, "/"), limit: 1 });
    if (!found.items.length) throw new Error(`The Supreme Court database has no decision ${nsHit[0]}.`);
    const d = await cl.nsText(found.items[0].unid);
    const h = d.header;
    const label = h.caseNumber || nsHit[0];
    return {
      kind: "case",
      court: "Nejvyšší soud",
      citation_en: `Supreme Court, ${label}${h.decisionDate ? `, ${h.decisionDate}` : ""}${h.ecli ? ` (${h.ecli})` : ""}`,
      citation_cs: `${h.decisionType || "rozhodnutí"} Nejvyššího soudu sp. zn. ${label}${h.ecli ? `, ${h.ecli}` : ""}`,
      url: d.url,
      markdown: mdLink(label, d.url),
      category: h.category || null,
      keywords: h.keywords || null,
      provisions: h.provisions || null,
      verified_text: d.text,
      retrieved: todayISO(),
    };
  }

  // --- EU law ---------------------------------------------------------------
  const celexHit = raw.match(CELEX_RE);
  const euAlias = resolveEuAlias(raw.replace(ARTICLE_RE, "").trim());
  if (celexHit || euAlias) {
    const celex = celexHit ? celexHit[1] : euAlias;
    const art = raw.match(ARTICLE_RE)?.[1] || null;
    const meta = await eu.metadata(celex, language);          // title/force from the base act
    const version = await resolveEuVersion(celex, asOf);      // text from the right version
    let snippet = null;
    let textCelex = version.celex;
    let degraded = null;
    if (art) {
      // CELLAR sometimes lists a consolidated CELEX in SPARQL that has no
      // retrievable text (404). Fall back rather than fail the citation, and
      // say which text the wording actually came from.
      const candidates = [version.celex, ...(version.fallbacks || []), eu.normalizeCelex(celex)]
        .filter((v, i, a) => a.indexOf(v) === i);
      let body = null;
      for (const cand of candidates) {
        try {
          body = await eu.fetchText(cand, language);
          textCelex = cand;
          if (cand !== version.celex) {
            degraded = `CELLAR has no ${language} text for ${version.celex}; the wording below is from ${cand} instead.`;
          }
          break;
        } catch { /* try the next candidate */ }
      }
      if (!body) {
        throw new Error(`CELLAR has no ${language} text for CELEX ${candidates.join(", ")}. Check ${eu.uiUrl(celex, language)}.`);
      }
      snippet = eu.sliceArticle(body.text, art, language);
      if (!snippet) {
        throw new Error(`Article ${art} was not found in CELEX ${textCelex} (${language}). Check the article number.`);
      }
    }
    // The alias is whatever is left once the article part is removed — using the
    // raw prefix instead would yield "Art." for "Art. 17 GDPR".
    const shortName = euAlias ? raw.replace(ARTICLE_RE, "").replace(/[,;]/g, " ").trim() || null : null;
    const label = art ? `Art. ${art} ${shortName || celex}` : shortName || celex;
    return {
      kind: "eu_legislation",
      celex: meta.celex,
      title: meta.title,
      in_force: meta.inForce,
      entry_into_force: meta.entryIntoForce,
      citation_en: `${art ? `Article ${art} of ` : ""}${meta.title || celex} (CELEX ${meta.celex})`,
      citation_cs: `${art ? `čl. ${art} ` : ""}${shortName || ""} (CELEX ${meta.celex})`.trim(),
      text_from_celex: textCelex,
      version_basis: version.basis,
      consolidated_versions: version.others ?? (version.celex.startsWith("0") ? 1 : 0),
      url: eu.uiUrl(version.celex, language),
      base_url: meta.uiUrl,
      eli: meta.eli,
      markdown: mdLink(label, eu.uiUrl(version.celex, language)),
      verified_text: snippet,
      as_of: asOf,
      retrieved: todayISO(),
      warning: [
        meta.inForce === false ? "This act is NOT in force." : null,
        version.uncertain ? "Could not confirm whether a consolidated version exists — the wording below may be superseded." : null,
        degraded,
      ].filter(Boolean).join(" ") || null,
    };
  }

  // --- Czech legislation ----------------------------------------------------
  const ref = czRefFrom(raw);
  if (ref) {
    const normalized = cz.normalizeRef(ref);
    const { version, repealed } = await cz.resolveVersion(normalized, asOf || "current");
    const doc = await cz.fragments(version.staleUrl);
    const title =
      doc.fragments.find((f) => f.type === "Prefix_Title")?.text ||
      doc.fragments.find((f) => f.type === "Prefix_Type")?.text ||
      null;

    const sectionHit = raw.match(SECTION_RE);
    let snippet = null;
    if (sectionHit) {
      const slice = cz.sliceSection(doc.fragments, `§ ${sectionHit[1]}`);
      if (!slice) throw new Error(`§ ${sectionHit[1]} does not exist in ${cz.citationOf(normalized)} (version ${version.effectiveFrom}).`);
      snippet = cz.renderFragments(slice);
    }
    const cit = cz.citationOf(normalized);
    const sec = sectionHit ? `§ ${sectionHit[1]} ` : "";
    const label = sectionHit ? `§ ${sectionHit[1]} of Act No. ${normalized.number}/${normalized.year} Coll.` : `Act No. ${normalized.number}/${normalized.year} Coll.`;
    const url = cz.permalink(version.staleUrl);
    return {
      kind: "cz_legislation",
      citation_en: `${sec}of Act No. ${normalized.number}/${normalized.year} Coll.${title ? `, ${title}` : ""}, as in force from ${version.effectiveFrom}${asOf ? ` (the version in force on ${asOf})` : ""}`,
      citation_cs: `${sec}zákona č. ${cit}${title ? `, ${title}` : ""}, ve znění účinném od ${version.effectiveFrom}`,
      title,
      version_in_force_from: version.effectiveFrom,
      version_in_force_to: version.effectiveTo || null,
      as_of: asOf,
      url,
      markdown: mdLink(label, url),
      verified_text: snippet,
      retrieved: todayISO(),
      warning: repealed
        ? `REPEALED — no version in force today; the text above is the last one that was (until ${version.effectiveTo}).`
        : null,
    };
  }

  throw new Error(
    `Could not read "${raw}" as a legal reference. Recognised forms: ` +
      `"§ 58 121/2000" or "§ 58 autorský zákon"; "Art. 17 GDPR" or "32016R0679 art 17"; ` +
      `"23 Cdo 3492/2021"; "I. ÚS 1234/21".`
  );
}
