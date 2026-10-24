import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseChat, ruleDigest, savings, words } from "./lib/digest.js";
import { modelDigest, status as ollamaStatus, DEFAULT_MODEL, OLLAMA_HOST } from "./lib/ollama.js";
import { openDb } from "./lib/db.js";

const MAX_CHARS = 200_000;

export function createApp(db = openDb()) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), "public")));

  app.get("/api/health", async (_req, res) => {
    const o = await ollamaStatus();
    res.json({ ok: true, ollama: { host: OLLAMA_HOST, defaultModel: DEFAULT_MODEL, ...o } });
  });

  app.post("/api/digest", async (req, res) => {
    const { chat, mode = "auto", model } = req.body ?? {};
    if (typeof chat !== "string" || !chat.trim()) return res.status(400).json({ error: "Send the chat text in `chat`." });
    if (chat.length > MAX_CHARS) return res.status(413).json({ error: `Chat is longer than ${MAX_CHARS} characters.` });
    if (!["auto", "model", "rules"].includes(mode)) return res.status(400).json({ error: "mode must be auto, model or rules." });

    const msgs = parseChat(chat);
    if (!msgs.length) return res.status(422).json({ error: "No messages found. Use lines like `Name: message`." });
    const totalWords = msgs.reduce((n, m) => n + words(m.text).length, 0);

    let lines, engine, note;
    if (mode !== "rules") {
      try {
        const out = await modelDigest(chat, model || DEFAULT_MODEL);
        lines = out.map((text) => ({ who: null, text }));
        engine = `ollama:${model || DEFAULT_MODEL}`;
      } catch (err) {
        if (mode === "model") return res.status(503).json({ error: `Local model unavailable: ${err.message}` });
        note = "Ollama was not reachable, so the rule-based digest was used.";
      }
    }
    if (!lines) {
      lines = ruleDigest(chat).lines;
      engine = "rules";
    }
    if (!lines.length) return res.status(422).json({ error: "Nothing stood out in this chat." });

    const stats = { messages: msgs.length, words: totalWords, ...savings(totalWords, lines.map((l) => l.text).join(" ")) };
    const id = db.save(engine, stats.messages, stats.words, lines);
    res.json({ id, engine, lines, stats, note });
  });

  app.get("/api/history", (_req, res) => res.json(db.history(10)));
  app.delete("/api/history", (_req, res) => {
    db.clear();
    res.status(204).end();
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`Slow Digest on http://localhost:${port}`));
}
