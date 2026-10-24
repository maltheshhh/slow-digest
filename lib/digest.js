// Rule-based digest. Used when no local model is reachable, and as the offline baseline.

const STOP = new Set(
  "the and for that this with you your have are was but not can its has had all out one get got just will would about from they them what when where who how why lol haha yes yeah okay ok also too then than there their here been being were into over some any more very like really right need want let see say said".split(" ")
);
const ACTION = /\b(deadline|submit|submission|bring|moved|postponed|cancel|cancelled|due|meet|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|pay|fee|signed|signature|printed|before|reminder|confirm|booked|rescheduled)\b/i;
const TIME = /\b(\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2}|at \d{1,2})\b/i;
const HEAD = /^\[?\s*\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap][Mm])?\s*\]?\s*[-–]?\s*/;

export function words(s) {
  return s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

const content = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));

/** Parse a WhatsApp/Telegram-style export into [{who, text}]. */
export function parseChat(text) {
  const msgs = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(HEAD, "").trim();
    if (!line) continue;
    const m = line.match(/^([^:\n]{1,32}):\s+(.+)$/);
    if (m) {
      if (/omitted|deleted/i.test(m[2]) && m[2].length < 30) continue;
      msgs.push({ who: m[1].trim(), text: m[2].trim() });
    } else if (msgs.length) {
      msgs[msgs.length - 1].text += " " + line;
    }
  }
  return msgs;
}

export function clip(s, max = 150) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 3).replace(/\s+\S*$/, "") + "…" : t;
}

/** Pick the two most useful messages, in chronological order. */
export function ruleDigest(text) {
  const msgs = parseChat(text);
  const freq = new Map();
  let totalWords = 0;
  for (const m of msgs) {
    totalWords += words(m.text).length;
    for (const w of new Set(content(m.text))) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  msgs.forEach((m, i) => {
    const uniq = new Set(content(m.text));
    let s = 0;
    for (const w of uniq) if (freq.get(w) > 1) s += freq.get(w);
    m.i = i;
    m.score =
      s / Math.sqrt(Math.max(uniq.size, 1)) +
      (ACTION.test(m.text) ? 4 : 0) +
      (TIME.test(m.text) ? 2.5 : 0) +
      (/\d/.test(m.text) ? 1 : 0) -
      (m.text.length < 18 ? 3 : 0);
  });

  const picks = [];
  for (const m of [...msgs].sort((a, b) => b.score - a.score)) {
    if (picks.length >= 2 || m.score <= 0) break;
    const mine = words(m.text);
    const dup = picks.some((p) => {
      const seen = new Set(words(p.text));
      const shared = mine.filter((w) => seen.has(w) && w.length > 3).length;
      return shared >= Math.ceil(mine.length * 0.6);
    });
    if (!dup) picks.push(m);
  }
  picks.sort((a, b) => a.i - b.i);

  return {
    lines: picks.map((p) => ({ who: p.who, text: clip(p.text) })),
    stats: { messages: msgs.length, words: totalWords },
  };
}

/** Reading time saved at 200 words per minute. */
export function savings(totalWords, digestText) {
  const digestWords = words(digestText).length;
  return {
    readSeconds: Math.round((totalWords / 200) * 60),
    digestSeconds: Math.max(1, Math.round((digestWords / 200) * 60)),
  };
}
