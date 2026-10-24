// Thin client for a local Ollama server. Nothing here talks to anything but OLLAMA_HOST.

export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
export const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

const PROMPT = (chat) => `You read a group chat and write a morning digest.
Write exactly two lines.
Line 1: the most important change or decision (what, when).
Line 2: the most important thing the reader must do (who, by when).
Ignore jokes, stickers, greetings and small talk. Do not add anything that is not in the chat.
Output only the two lines, no labels, no bullets.

CHAT:
${chat}
`;

async function call(path, init, timeoutMs) {
  const res = await fetch(`${OLLAMA_HOST}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  return res.json();
}

/** Returns { reachable, models[] }. Never throws. */
export async function status() {
  try {
    const data = await call("/api/tags", {}, 1500);
    return { reachable: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { reachable: false, models: [] };
  }
}

/** Ask the model for a two-line digest. Throws if Ollama is unreachable or the model is missing. */
export async function modelDigest(chat, model = DEFAULT_MODEL) {
  const tail = chat.slice(-24000); // newest part of very long chats
  const data = await call(
    "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: PROMPT(tail), stream: false, options: { temperature: 0.2 } }),
    },
    120000
  );
  const lines = String(data.response ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|line\s*\d+:)\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!lines.length) throw new Error("Model returned no text");
  return lines;
}
