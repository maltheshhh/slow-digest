#!/usr/bin/env python3
"""Slow Digest: summarize an exported group chat into two lines with a local open-weight model.

Needs Ollama running locally (https://ollama.com) and a pulled model, e.g.:
    ollama pull llama3.2:3b
    python sloth_digest.py chat.txt --model llama3.2:3b --out digest.txt

Standard library only. Nothing leaves localhost.
"""
import argparse
import json
import sys
import urllib.request

PROMPT = """You read a group chat and write a morning digest.
Write exactly two lines.
Line 1: the most important change or decision (what, when).
Line 2: the most important thing the reader must do (who, by when).
Ignore jokes, stickers, greetings and small talk. Do not add anything not in the chat.

CHAT:
{chat}
"""


def ask(model: str, chat: str, host: str) -> str:
    body = json.dumps({"model": model, "prompt": PROMPT.format(chat=chat), "stream": False,
                       "options": {"temperature": 0.2}}).encode()
    req = urllib.request.Request(f"{host}/api/generate", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        return json.load(resp)["response"].strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("chat_file")
    ap.add_argument("--model", default="llama3.2:3b")
    ap.add_argument("--host", default="http://localhost:11434")
    ap.add_argument("--out", default="")
    ap.add_argument("--max-chars", type=int, default=24000,
                    help="keep only the newest part of very long chats")
    args = ap.parse_args()

    with open(args.chat_file, encoding="utf-8", errors="replace") as f:
        chat = f.read()[-args.max_chars:]
    try:
        digest = ask(args.model, chat, args.host)
    except OSError as e:
        print(f"Could not reach Ollama at {args.host}: {e}", file=sys.stderr)
        return 1

    lines = [l for l in digest.splitlines() if l.strip()][:2]
    text = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
