# AI Quiz Builder — Presentation

Reveal.js slide deck for the Entrata technical interview.

- `index.html` — the deck (23 slides)
- `speaker-notes.md` — per-slide narration, audience tailoring, prepared Q&A

---

## Run it

```bash
cd /Users/aaronmatson/Documents/Personal-Projects/Entrata/presentation
python3 -m http.server 8765
```

Open: <http://localhost:8765/>

If port 8765 is taken, swap to anything free (`8000`, `9000`, etc.).

---

## Present it

| Key | Action |
|-----|--------|
| `→` / `space` | Next slide |
| `←` | Previous slide |
| `f` | Fullscreen |
| `s` | Speaker view (opens a second window — notes + next slide + timer) |
| `esc` | Slide overview |
| `b` | Black out screen |
| `?` | Keyboard shortcuts cheatsheet |

**For the actual interview:** fullscreen the deck on the demo laptop, open `speaker-notes.md` on the second monitor (or phone). Don't use Reveal's built-in speaker view unless you've tested it on the projector setup — it can be flaky over external displays.

---

## Export to PDF (leave-behind)

```
http://localhost:8765/?print-pdf
```

Then Cmd+P → "Save as PDF". Preserves every pixel of the dark theme. Send the PDF to interviewers after the call; present from the live HTML during.

---

## Demo flow during the talk

Slide 22 ("Live demo") lists the six scripted moments. Have these tabs pre-opened in a second browser window:

1. The deployed quiz app (Vercel URL)
2. DevTools open on the Network tab (to show no API key in client + SSE stream)
3. The repo on GitHub (commits + Actions tab)

Don't tab-switch live — alt-tab between windows so the deck stays in fullscreen.

---

## Editing the deck

- Content: all in `index.html`, one `<section>` per slide
- Theme/colors: CSS variables at the top of the `<style>` block (`--accent`, `--accent-2`, `--bg`)
- Canvas size: `Reveal.initialize({ width: 1280, height: 960, ... })` near the bottom
- Auto-fit: a JS hook scales any overflowing slide down — you can paste long content into a slide and it'll shrink to fit rather than clip

After edits, hard-reload the browser (Cmd+Shift+R) to bypass cache.

---

## If it doesn't load

White screen = CDN blocked. The deck pulls Reveal.js from `cdn.jsdelivr.net`. If a corporate network or browser extension is blocking it, either disable the blocker on localhost or vendor Reveal.js locally (ask Claude to inline it).

Check DevTools → Console + Network. Failed requests to `jsdelivr.net` are the smoking gun.
