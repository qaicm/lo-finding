# LO Finding — Frontend

Learning Objective Finding: find the exact Cambridge learning objectives (Checkpoint, IGCSE, AS–A Level) for a lesson, with AKT levels (Anderson & Krathwohl), period allocation, teaching suggestions, differentiation (3×3) and formative/summative assessments.

- **Frontend:** this folder (vanilla HTML/CSS/JS SPA) → GitHub Pages
- **Backend:** Google Apps Script REST API (separate files, not in this repo)

## Setup
1. Edit `js/config.js` → set `GAS_URL` to your Apps Script Web App `/exec` URL.
2. Push this folder (with `index.html` at the root) to a public GitHub repo and enable **Settings → Pages → main / (root)**.

## Structure
```
index.html          app shell + no-flash theme bootstrap
css/style.css       design tokens (theme-swappable), components
js/config.js        GAS_URL (the only value you edit)
js/icons.js         Lucide icon subset (ISC license)
js/core.js          API client (timeout/retry/idempotent), SWR cache, router, theme engine, auth
js/guru.js          Teacher portal: Find LO, Results, Upload, My Documents, History
js/admin.js         Admin panel (lazy-loaded after admin login)
js/charts.js        Lightweight SVG charts (lazy-loaded with admin)
js/vendor/          SheetJS fallback copy (loaded only for Excel import/export)
```

No secrets live here — all secrets are in Apps Script **Script Properties**.
