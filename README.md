# Ground Truth — Langur Habitat Monitor

An open-source habitat-loss, fragmentation and risk monitoring tool for the Critically
Endangered Delacour's langur in northern Vietnam. It turns satellite data into clear,
decision-ready maps and reports so conservation teams can see where habitat is being lost,
where it is fragmenting, and where langurs are most at risk.

## The flow

**Habitat loss → Fragmentation → Habitat risk → Policy → Report**

## Repo structure

- **`pipeline/`** — Google Earth Engine + Python metrics that compute the habitat layers.
- **`web/`** — React + Vite + MapLibre frontend that visualizes the layers and reports.
- **`data-contract/`** — shared JSON schema for the data exchanged between the two.

## Getting started

1. Copy `.env.example` to `.env` and fill in your values (the real `.env` is git-ignored).
2. **Web:**
   ```bash
   cd web && npm install && npm run dev
   ```
3. **Pipeline:** see [`pipeline/README.md`](pipeline/README.md).

## Data sensitivity

This project monitors a Critically Endangered species. Precise langur and threat locations
are poaching-sensitive and must **never** be committed. Read
[SECURITY.md](SECURITY.md) before contributing.

## License

[MIT](LICENSE).

## Credits

AIforgood Asia · Save Vietnam's Wildlife · SUTD
