# Slow Digest

A two-line morning summary of your group chat, written by an open-weight model running on your own machine.

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 3: Slow and Steady.

Paste an exported chat, get two lines: what changed, and what you must do. Jokes, stickers and goodnights are skipped.

## Why open

- **Chats stay on your machine.** The server only talks to Ollama on localhost.
- **Works offline.** If no model is installed, a rule-based digest takes over.
- **Swap the model.** Set `OLLAMA_MODEL` or choose one per request.
- **No cost per run.** No API key.

## Stack

- Node 22 + Express (API and static hosting)
- Ollama (any open-weight model it can serve)
- SQLite via the built-in `node:sqlite` for digest history
- Plain HTML, CSS and JS frontend

## Run it

```bash
ollama pull llama3.2:3b     # optional, enables the model engine
npm install
npm start                   # http://localhost:3000
```

Copy `.env.example` to `.env` and export the values if you want to change the port, host or model.

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | | Ollama reachability and installed models |
| POST | `/api/digest` | `{ chat, mode?: "auto" \| "model" \| "rules", model? }` | `{ engine, lines, stats, note? }` |
| GET | `/api/history` | | Last 10 digests |
| DELETE | `/api/history` | | Clears history |

Chat lines look like `[23/10/26, 21:04] Riya: message` (WhatsApp) or `Riya: message`.

## Overnight mode

`scripts/sloth_digest.py` does the same job from the command line with no dependencies, so cron can run it while you sleep:

```bash
python scripts/sloth_digest.py chat.txt --model llama3.2:3b --out ~/digest.txt

# crontab: every night at 3
0 3 * * * python ~/slow-digest/scripts/sloth_digest.py ~/chat.txt --out ~/digest.txt
```

## Tests

```bash
npm test
```

## License

MIT
