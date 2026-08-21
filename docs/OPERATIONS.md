# Operations

Runbook for keeping the data current. For architecture, data pipeline, and render mapping see
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## Updating the Data

The canonical monthly values live in `data/*.json`; the inline arrays in the HTML compositions are
generated from them and never hand-edited. After the source data changes:

1. `node scripts/sync-data.mjs --check` — confirms there is drift before touching anything.
2. `node scripts/sync-data.mjs` — regenerates the inline arrays in all HTML compositions from
   `data/*.json`. See [ARCHITECTURE.md](ARCHITECTURE.md#single-source-of-truth-scriptssync-datamjs)
   for the schema and sources.
3. `npm test` must pass before committing.

Deployment and media hosting are operator-specific and outside the scope of this repository.

## Further Documentation

- Architecture, data pipeline, render mapping: [ARCHITECTURE.md](ARCHITECTURE.md)
