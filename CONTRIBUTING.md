# Contributing

Thanks for helping protect the Delacour's langur. Please read
[SECURITY.md](SECURITY.md) before contributing — **never commit secrets or precise
location data.**

## Branching

- One branch per task, named `<area>/<issue>-<slug>`, e.g. `fe/D1-habitat-loss`.
- `main` stays deployable at all times.

## Pull requests

- Every PR must say **`Closes #<issue>`** so the issue closes on merge.
- PRs need **one review** before merging to `main`.

## Definition of Done

A change is done only when:

- [ ] It **builds and runs**.
- [ ] It has been **reviewed** (one approval).
- [ ] The **UI works in light + dark** and on **desktop + phone**, and has been
      **clicked through end-to-end**.
- [ ] **Data numbers reconcile** and the **method is documented**.
- [ ] **No secrets or precise location data** were committed.
