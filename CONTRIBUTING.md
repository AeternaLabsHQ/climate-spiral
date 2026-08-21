# Contributing

Thanks for your interest in the Climate Spiral. Contributions in English are
preferred, but issues and pull requests are just as welcome in German.

## Workflow

- Issues and pull requests are welcome.
- Before every PR: `npm test` must pass.
- Never hand-edit data files (the JSON files under `data/` or the
  compositions) — they are generated exclusively via
  `node scripts/sync-data.mjs` from the GISTEMP source. Hand edits get
  overwritten on the next sync and otherwise silently drift from the source.
- Small, focused PRs are easier to review.

## License

The code is MIT-licensed (see `LICENSE`). Media (renders, videos, poster
images) is CC BY 4.0 — reuse with attribution is explicitly encouraged.

---

## German TL;DR

Beiträge in Englisch werden bevorzugt, Deutsch ist aber ebenso willkommen.
Vor jedem PR: `npm test` muss grün laufen. Daten niemals von Hand bearbeiten
— stattdessen `node scripts/sync-data.mjs` verwenden. Code ist MIT-lizenziert;
Medien-Assets stehen unter CC BY 4.0.
