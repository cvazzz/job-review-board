# Job Review Board

A small static web app for reviewing job offers that have already been scored, and deciding by hand which ones to apply to. No build step, no dependencies, no backend.

Author: Sergio Atanacio. License: MIT.

## Why

Automating a job search is easy to get wrong in the direction that matters: applications that go out without anyone looking at them. This board puts a person between "scored" and "sent". Each offer shows its score, strengths, gaps, risks, the application method and the CV variant that would be used. You approve, hold, discard or send an offer back to review.

Approving sends nothing. It only records a decision (with a two-step confirmation) that another tool can read later.

## Run it

```
python -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works, but browsers often block `fetch` on `file://`. In that case use the "Load jobs file" button to pick a JSON file.

Data source order: `data/jobs.local.json` if it exists (silently ignored if not), otherwise `data/jobs.demo.json`. You can always load another file with the file picker.

Tests (Node 18+, no packages to install):

```
npm test        # or: node --test tests/*.test.js
```

## Age of the offer

Each offer shows how long ago it was posted ("Posted 9 days ago": green up to 14 days, amber up to 45, red beyond), the posting date and, when the source gives one, the closing date. You can filter by maximum age (14, 30 or 60 days) and sort by newest first. Offers without a date are flagged and sorted last.

The board reads the job agent's own field names too (`publicada`, `salario`, `pais`, `metodo`, `verificacion`, `cv_file`), so the agent's `data/jobs.json` can be loaded as is. The demo data uses `dias_atras` (days ago) so its dates never go stale.

## Privacy

The hosted page ships fictional demo data only. Real offers are loaded with "Load jobs file" and stay in the browser: nothing is uploaded, and decisions are kept in localStorage.

## Decisions

Decisions are stored in the browser's `localStorage`. Use "Export decisions.json" to save them and "Import decisions.json" to restore them. Format:

```json
{ "version": 1, "decisions": { "demo-001": { "status": "approved", "decided_at": "2026-01-01T12:00:00.000Z" } } }
```

Statuses: `pending` (implicit), `approved`, `hold`, `discarded`. Allowed moves: pending to any; approved and hold to any other; discarded back to pending only.

To hand approved offers to another tool:

```
node scripts/export_approved.mjs decisions.json [jobs.json] -o approved_queue.json
```

## Data format

A JSON array (or `{ "jobs": [...] }`) of objects. Keys are the Spanish column names the original pipeline used. Only `id` and `puesto` (job title) are required.

`id, empresa, puesto, url, fuente, pais_elegible, modalidad, idioma, fecha_publicacion, salario_publicado, moneda, salario_mensual_usd_est, cumple_piso, score, prioridad, metodo_postulacion, requiere_humano, estado_verificacion, fortalezas, brechas, riesgos, notas, cv_variant`

- `score`: 0 to 100. `prioridad`: `alta`, `media` or `baja`. `idioma`: `ES` or `EN`.
- `cumple_piso` and `requiere_humano`: `si`/`no` (or booleans).
- `url` must be `https://`; anything else is dropped and shown as "No valid https link".
- `cv_variant` is optional. If missing it is derived from the title: AI, agent, automation to `AI-Automation`; data analyst, BI, data engineer to `Data-BI`; everything else `Software`.

### From a CSV

```
python -I scripts/import_csv.py offers.csv
```

Reads a UTF-8 CSV (a BOM is handled) with the columns above and writes `data/jobs.local.json`.

## Privacy

`data/jobs.demo.json` is entirely fictional (invented companies, `example.com` URLs). Real data goes in `data/jobs.local.json`, and decisions in `decisions*.json`; both, plus `approved_queue.json` and any `.env`, are in `.gitignore` so they are never committed. The app makes no network requests besides optional Google Fonts (it falls back to system fonts) and your own local files. All fields are inserted with `textContent`, never `innerHTML`.

## Limitations

- Scoring is not done here. The board only displays scores computed elsewhere.
- The salary "floor" is a flag in your data (`cumple_piso`), not a calculation.
- Decisions live in one browser profile. Clearing site data erases them unless exported.
- Nothing sends applications, and nothing checks that a posting is still open.
- The UI is in English; the data keys are Spanish for compatibility with the original pipeline.
- Tested manually in Chromium-based browsers only.
