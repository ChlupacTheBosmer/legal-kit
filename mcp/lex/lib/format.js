const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "",
  mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»",
  bdquo: "„", ldquo: "“", rdquo: "”", sbquo: "‚", lsquo: "‘", rsquo: "’",
  sect: "§", para: "¶", deg: "°", middot: "·", times: "×", euro: "€",
};

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}

/** Strip tags from an HTML/XHTML fragment, preserving block breaks. */
export function htmlToText(html) {
  if (!html) return "";
  return decodeEntities(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|table|blockquote)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Truncate with an explicit, honest marker so nothing silently disappears. */
export function clamp(text, maxChars, hint = "") {
  if (!maxChars || text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const at = cut.lastIndexOf("\n");
  const kept = at > maxChars * 0.6 ? cut.slice(0, at) : cut;
  return `${kept}\n\n[... TRUNCATED: ${text.length - kept.length} of ${text.length} characters not shown.${
    hint ? " " + hint : ""
  }]`;
}

export function block(title, lines) {
  return [`## ${title}`, "", ...lines].join("\n");
}
