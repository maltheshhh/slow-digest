// Digest history in SQLite (node:sqlite, built into Node 22). No native packages to install.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(file = process.env.DB_FILE ?? "data/digest.db") {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    engine TEXT NOT NULL,
    messages INTEGER NOT NULL,
    words INTEGER NOT NULL,
    lines TEXT NOT NULL
  )`);
  const insert = db.prepare("INSERT INTO digests (engine, messages, words, lines) VALUES (?, ?, ?, ?)");
  const recent = db.prepare("SELECT id, created_at, engine, messages, words, lines FROM digests ORDER BY id DESC LIMIT ?");
  const wipe = db.prepare("DELETE FROM digests");
  return {
    save(engine, messages, words, lines) {
      return Number(insert.run(engine, messages, words, JSON.stringify(lines)).lastInsertRowid);
    },
    history(limit = 10) {
      return recent.all(limit).map((r) => ({ ...r, lines: JSON.parse(r.lines) }));
    },
    clear() {
      wipe.run();
    },
  };
}
