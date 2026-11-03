/* Timeline input guard. One file, used in the browser and on the server.
   It refuses the kinds of text a life timeline never needs: links, code, contact
   details, ID and account numbers, street addresses, exact birth dates.
   Refused pieces are cut out and named, so the person sees exactly what was dropped. */
(function (root) {
  "use strict";
  const MAX_INPUT = 1200;   // characters of free text a visitor can send
  const MAX_FIELD = { when: 28, line: 80, detail: 240, kanji: 2 };

  // Order matters: the most specific patterns run first so the label is the right one.
  const RULES = [
    { kind: "code",    label: "HTML or code",          re: /<\s*\/?\s*[a-z!][^>]*>|javascript\s*:|data\s*:\s*text|on[a-z]+\s*=|\{\{|\}\}|```|<\?|\$\{/gi },
    { kind: "email",   label: "an email address",      re: /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}|[a-z0-9._%+-]+\s*[\(\[]at[\)\]]\s*[a-z0-9.-]+\s*[\(\[]dot[\)\]]\s*[a-z]{2,}/gi },
    { kind: "link",    label: "a link",                re: /\b(?:https?|ftp|file|ws)s?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|io|ai|app|dev|co|me|us|uk|jp|ca|de|fr|ly|gg|xyz|info|biz|site|online|link|page|sh)\b(?:\/\S*)?/gi },
    { kind: "ssn",     label: "an ID number",          re: /\b\d{3}[-\s.]\d{2}[-\s.]\d{4}\b/g },
    { kind: "card",    label: "a card or account number", re: /\b(?:\d[ -]?){13,19}\b|\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}\b/g },
    { kind: "phone",   label: "a phone number",        re: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{0,4}\b|\+\d{7,15}\b/g },
    { kind: "date",    label: "an exact date",         re: /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{4}\b/gi },
    { kind: "address", label: "a street address",      re: /\b\d{1,6}\s+(?:[A-Za-z0-9'.-]+\s+){0,4}(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|circle|cir|highway|hwy|parkway|pkwy|square|sq|apt|apartment|suite|unit)\b\.?/gi },
    { kind: "postal",  label: "a postal code",         re: /\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b|\b\d{3}-\d{4}\b/g },
    { kind: "idnum",   label: "an ID number",          re: /\b[A-Z]{1,2}\d{6,9}\b|\b\d{9,12}\b/g },
    { kind: "number",  label: "a long number",         re: /\b\d{5,}\b/g },
    { kind: "handle",  label: "a social handle",       re: /(?:^|[\s(])@[a-z0-9_.]{2,30}\b/gi },
    { kind: "secret",  label: "a password or key",     re: /\b(?:password|passcode|pin|api[_\s-]?key|secret|token)\b\s*(?:is|:|=)\s*\S+|\b(?:sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{8,}\b/gi }
  ];

  function normalize(s) {
    return String(s == null ? "" : s)
      .normalize("NFKC")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** Clean free text. Returns { text, removed:[{kind,label,sample}], tooLong, empty }. */
  function clean(input, max = MAX_INPUT) {
    let text = normalize(input);
    const tooLong = text.length > max;
    if (tooLong) text = text.slice(0, max);
    const removed = [];
    for (const r of RULES) {
      text = text.replace(r.re, (m) => {
        const lead = /^[\s(]/.test(m) ? m[0] : "";
        const core = m.slice(lead.length).trim();
        if (!core) return m;
        // a bare year is fine: "2019" is a moment, not an identifier
        if ((r.kind === "number" || r.kind === "postal") && /^(1[89]|20)\d{2}$/.test(core)) return m;
        removed.push({ kind: r.kind, label: r.label, sample: core.length > 4 ? core.slice(0, 2) + "…" : "…" });
        return lead + "▢";
      });
    }
    text = text.replace(/(▢\s*){2,}/g, "▢ ").trim();
    const letters = text.replace(/▢/g, "").replace(/[^\p{L}]/gu, "").length;
    return { text, removed, tooLong, empty: letters < 3 };
  }

  /** True when a short string would be refused (used on everything a model writes). */
  function refused(s) { const c = clean(s, 400); return c.removed.length > 0; }

  const CJK = /^[㐀-䶿一-鿿豈-﫿぀-ヿ々〆ヶ]{1,2}$/;
  const CHAPTERS = ["roots", "craft", "work", "making", "now", "ahead"];
  const KINDS = ["event", "ahead"];

  function field(v, max) {
    const raw = normalize(v).replace(/[\r\n]+/g, " ");
    if (!raw) return "";
    if (refused(raw)) return null;
    const s = raw.replace(/[<>{}`$\\]/g, "");
    const cut = s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
    return refused(cut) ? null : cut;
  }

  /** Check a model's timeline. Returns { moments, dropped } with only safe, well-formed moments. */
  function checkMoments(raw, pickKanji) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.moments) ? raw.moments : raw && Array.isArray(raw.events) ? raw.events : [];
    const moments = []; let dropped = 0;
    for (const m of list.slice(0, 24)) {
      if (!m || typeof m !== "object") { dropped++; continue; }
      const line = field(m.line || m.title || m.what, MAX_FIELD.line);
      const when = field(m.when || m.time || m.year || "", MAX_FIELD.when);
      const detail = field(m.detail || m.story || m.description || "", MAX_FIELD.detail);
      if (!line || line.length < 3 || when === null || detail === null) { dropped++; continue; }
      let kanji = normalize(m.kanji || "").replace(/\s/g, "");
      if (!CJK.test(kanji)) kanji = pickKanji ? pickKanji(line + " " + (detail || "")) : "事";
      let chapter = String(m.chapter || "").toLowerCase();
      const kind = KINDS.includes(m.kind) ? m.kind : chapter === "ahead" ? "ahead" : "event";
      if (!CHAPTERS.includes(chapter) || chapter === "now") chapter = kind === "ahead" ? "ahead" : "making";
      if (kind === "ahead") chapter = "ahead";
      const splat = m.splat === "red" || m.splat === "black" ? m.splat : "none";
      moments.push({ kind, chapter, when: when || "", kanji, line, detail: detail || "", splat });
    }
    return { moments: moments.slice(0, 16), dropped };
  }

  const api = { clean, refused, normalize, checkMoments, MAX_INPUT, MAX_FIELD, CHAPTERS, RULES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TLGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
