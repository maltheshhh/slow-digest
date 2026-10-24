const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (s) => (s >= 60 ? `${(s / 60).toFixed(1)} min` : `${s} s`);

/* Sloth odometer: 4 m/min assumed, track is 10 m long. */
const t0 = Date.now();
function tick() {
  const m = ((Date.now() - t0) / 60000) * 4;
  $("dist").textContent = `${m.toFixed(2)} m`;
  $("sloth").style.left = `${2 + ((m % 10) / 10) * 86}%`;
}
setInterval(tick, 1000);
tick();

async function api(path, init) {
  const res = await fetch(path, init);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadStatus() {
  const el = $("status");
  try {
    const { ollama } = await api("/api/health");
    if (ollama.reachable && ollama.models.length) {
      el.className = "status on";
      el.lastElementChild.textContent = `Ollama is running. Models: ${ollama.models.slice(0, 3).join(", ")}${ollama.models.length > 3 ? "…" : ""}`;
    } else if (ollama.reachable) {
      el.className = "status off";
      el.lastElementChild.textContent = `Ollama is running but has no models. Run: ollama pull ${ollama.defaultModel}`;
    } else {
      el.className = "status off";
      el.lastElementChild.textContent = "Ollama not found. Rule-based digest will be used.";
    }
  } catch {
    el.className = "status off";
    el.lastElementChild.textContent = "Server not reachable.";
  }
}

function showResult(r) {
  const body = r.lines
    .map((l) => `<div class="line">${l.who ? `<span class="who">${esc(l.who)}</span>` : ""}${esc(l.text)}</div>`)
    .join("");
  const s = r.stats;
  $("out").innerHTML =
    body +
    `<div class="saved">Engine <b>${esc(r.engine)}</b>. <b>${s.messages}</b> messages, <b>${s.words}</b> words. Reading time <b>${fmt(s.readSeconds)}</b> becomes <b>${fmt(s.digestSeconds)}</b>.${r.note ? `<br>${esc(r.note)}` : ""}</div>`;
}

async function digest() {
  const btn = $("go");
  btn.disabled = true;
  btn.textContent = "Digesting slowly…";
  try {
    const r = await api("/api/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat: $("chat").value, mode: $("mode").value }),
    });
    showResult(r);
    loadHistory();
  } catch (e) {
    $("out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Digest it";
  }
}

async function loadHistory() {
  try {
    const rows = await api("/api/history");
    $("history").innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<li><span class="meta">${esc(new Date(r.created_at).toLocaleString())} · ${esc(r.engine)} · ${r.messages} msgs</span>${r.lines.map((l) => esc(l.text)).join("<br>")}</li>`
          )
          .join("")
      : '<li class="note">No digests yet.</li>';
  } catch {
    /* history is optional */
  }
}

$("go").addEventListener("click", digest);
$("clear").addEventListener("click", () => {
  $("chat").value = "";
  $("chat").focus();
});
$("wipe").addEventListener("click", async () => {
  await api("/api/history", { method: "DELETE" });
  loadHistory();
});

loadStatus();
loadHistory();
digest();
