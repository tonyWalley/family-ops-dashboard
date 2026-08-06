# Family Ops Dashboard

A dependency-free, mobile-friendly dashboard shell for household cash planning, bills, budgets, tasks, and structured JSON updates.

## Privacy model

This repository intentionally contains **no household financial data**. The published site is only the application shell. Private data is imported in the browser from `WFOS_CURRENT_STATE.json`, stored locally on the device, and exported back to Dropbox by the user.

Never commit any real current-state JSON, statements, account details, balances, or exported HTML snapshots to this repository.

## Use on iPhone

1. Open the GitHub Pages address in Safari.
2. Tap **Share → Add to Home Screen** and enable **Open as Web App**.
3. Open the installed app.
4. Tap **Import latest JSON** and select the private `WFOS_CURRENT_STATE.json` from Dropbox.
5. After updates, tap **Share current JSON** and replace the shared Dropbox file.

## Deployment

The included GitHub Actions workflow deploys the repository root to GitHub Pages. In repository settings, choose **Pages → Source: GitHub Actions**.

## Files

- `index.html` — dashboard application shell
- `styles.css` — responsive dashboard styling
- `app.js` — calculations, editing, import/export, and local autosave
- `manifest.webmanifest` — installable web-app metadata
- `sw.js` — offline shell cache
- `icon.svg` — dashboard icon
- `.github/workflows/pages.yml` — GitHub Pages deployment

Github Pages deployment initalized
