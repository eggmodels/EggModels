# Site improvement backlog

Seed ideas for the weekly factory run (see [`README.md`](./README.md)). The
factory picks one unchecked item per run, working top-down, and checks it off
with a link to the PR once that PR is open. If this list ever empties out,
the `factory-picker` role adds a similarly small, low-risk idea here before
implementing it.

- [ ] Type `Dashboard.tsx` — `Tennis.tsx` already got TypeScript types
      (2026-09-17 batch); the Cloud-Functions-backed Dashboard component
      hasn't.
- [ ] Centralize Cloud Functions URLs — `Dashboard.js` calls
      `https://us-central1-egg-models.cloudfunctions.net/...` as a hardcoded
      string in more than one place; pull into one shared constant/config.
- [ ] MLB precomputed insights — mirror the NFL model's precomputed-JSON
      pattern (see CLAUDE.md's Architecture section) for MLB once that
      pipeline has data to precompute.
- [ ] Firestore read caching — `Tennis.js` / `Dashboard.js` re-read
      `model_outputs` / call Cloud Functions on every mount; add light
      client-side caching to cut reads.
- [ ] Check hardcoded emails in `Blog.tsx` — audit for addresses that
      shouldn't be committed in plaintext, and move them to config/env if
      so.

Add new ideas to the bottom as you think of them.
