"""Tests for the habitat-loss metrics.

Two layers:

* **Unit** — exact, hand-computed checks of the pure functions on a tiny
  synthetic 2017->2025 grid. These never touch disk and must always pass.
* **Integration** — runs the real script against the default input rasters and
  asserts the invariants the numbers must satisfy (drivers sum to 100, core
  <= remaining, the union rollup is >= every region, and the run is
  deterministic). Skipped automatically when the local inputs are absent.

Run from the repo root inside the venv:
    pip install pytest
    pytest pipeline/metrics/ -v
"""
from __future__ import annotations

import csv
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

import habitat_loss as hl  # noqa: E402


# --- Unit: pure helpers -----------------------------------------------------

def test_binary_erosion_shaves_one_ring():
    """One iteration of 4-connected erosion removes the outer ring."""
    m = np.ones((5, 5), dtype=bool)
    eroded = hl.binary_erosion(m, 1)
    # Only the inner 3x3 survives (array border is forced off).
    assert eroded.sum() == 9
    assert eroded[0, :].sum() == 0 and eroded[:, 0].sum() == 0
    assert eroded[2, 2]


def test_driver_shares_even_split_sums_to_100():
    # One lost pixel to each destination -> ~33% each, drift lands on the first.
    shares = hl._driver_shares({1: 1, 3: 1, 4: 1}, 3)
    assert shares == {"driver_mining": 34, "driver_farming": 33, "driver_other": 33}
    assert sum(shares.values()) == 100


def test_driver_shares_single_driver():
    shares = hl._driver_shares({3: 4}, 4)  # all loss is forest->agriculture
    assert shares == {"driver_mining": 0, "driver_farming": 100, "driver_other": 0}


def test_driver_shares_no_loss_is_all_zero():
    shares = hl._driver_shares({}, 0)
    assert shares == {"driver_mining": 0, "driver_farming": 0, "driver_other": 0}
    assert sum(shares.values()) == 0


# --- Unit: full metric computation on a synthetic grid ----------------------

def _synthetic_grids():
    """A 6x6 pair with hand-countable transitions.

    Class codes: 0 background, 1 quarry, 2 forest(=habitat), 3 agriculture,
    4 urbanisation.

    2025 (`b`): a clean 4x4 forest block (rows 1-4, cols 1-4 = 16 px) plus one
    quarry, one agriculture and one urbanisation pixel down the right edge.

    2017 (`a`): equals `b`, except
      - two forest-block pixels were non-forest in 2017  -> 2 px of gain,
      - the three right-edge class pixels were forest in 2017 -> 3 px of loss,
        one to each driver (quarry=mining, ag=farming, urban=other).
    """
    B, F, Q, A, U = 0, 2, 1, 3, 4
    b = np.array([
        [B, B, B, B, B, B],
        [B, F, F, F, F, Q],
        [B, F, F, F, F, A],
        [B, F, F, F, F, U],
        [B, F, F, F, F, B],
        [B, B, B, B, B, B],
    ], dtype=np.uint8)
    a = b.copy()
    a[1, 1] = A   # agriculture -> forest  (gain)
    a[4, 4] = Q   # quarry      -> forest  (gain)
    a[1, 5] = F   # forest -> quarry       (loss, mining)
    a[2, 5] = F   # forest -> agriculture  (loss, farming)
    a[3, 5] = F   # forest -> urbanisation (loss, other)
    return a, b


def test_metrics_in_mask_exact():
    a, b = _synthetic_grids()
    mask = np.ones_like(a, dtype=bool)
    # pixel_m=100 -> erosion depth is exactly 1 pixel; px_area_ha=1 -> ha == px.
    m = hl.metrics_in_mask(a, b, mask, px_area_ha=1.0, pixel_m=100.0)

    assert m["habitat_remaining"] == pytest.approx(16.0)   # b==forest
    assert m["habitat_lost"] == pytest.approx(3.0)         # gross forest->non-forest
    assert m["forest_gain"] == pytest.approx(2.0)          # non-forest->forest
    assert m["quarry_footprint"] == pytest.approx(1.0)     # b==quarry
    assert m["core_habitat"] == pytest.approx(4.0)         # 4x4 block eroded by 1 -> 2x2
    # loss_rate = lost / forest_2017 / 8yr * 100 = 3 / 17 / 8 * 100
    assert m["loss_rate"] == pytest.approx(3 / 17 / 8 * 100, abs=0.01)
    assert m["driver_mining"] == 34
    assert m["driver_farming"] == 33
    assert m["driver_other"] == 33


def test_loss_rate_tracks_year_span():
    """loss_rate divides by the `years` span, so a wider span -> smaller rate."""
    a, b = _synthetic_grids()
    mask = np.ones_like(a, dtype=bool)
    # Same pixels, different epoch span: 3 lost / 17 forest_start, over N years.
    m8 = hl.metrics_in_mask(a, b, mask, px_area_ha=1.0, pixel_m=100.0, years=8)
    m10 = hl.metrics_in_mask(a, b, mask, px_area_ha=1.0, pixel_m=100.0, years=10)
    assert m8["loss_rate"] == pytest.approx(3 / 17 / 8 * 100, abs=0.01)
    assert m10["loss_rate"] == pytest.approx(3 / 17 / 10 * 100, abs=0.01)
    # Only the rate changes; the area metrics are span-independent.
    assert m8["habitat_lost"] == m10["habitat_lost"]


def test_year_flags_label_output(tmp_path):
    """--year-start/--year-end flow into the CSV labels and source_script."""
    if not _inputs_present:
        pytest.skip("local rasters / study-area geometry not present")
    out = tmp_path / "custom_years.csv"
    subprocess.run(
        [sys.executable, "-I", str(HERE / "habitat_loss.py"),
         "--out", str(out), "--year-start", "2020", "--year-end", "2030"],
        cwd=str(REPO), check=True, capture_output=True, text=True,
    )
    with open(out, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert rows, "no rows produced"
    assert all(r["year_start"] == "2020" for r in rows)
    assert all(r["year_end"] == "2030" for r in rows)
    assert all(r["source_script"] == "habitat_loss_2020_2030" for r in rows)


def test_year_end_must_exceed_start():
    """A non-positive span is rejected rather than silently dividing by <= 0."""
    proc = subprocess.run(
        [sys.executable, "-I", str(HERE / "habitat_loss.py"),
         "--year-start", "2025", "--year-end", "2017"],
        cwd=str(REPO), capture_output=True, text=True,
    )
    assert proc.returncode != 0
    assert "must be greater" in (proc.stderr + proc.stdout)


def test_core_never_exceeds_remaining_synthetic():
    a, b = _synthetic_grids()
    mask = np.ones_like(a, dtype=bool)
    m = hl.metrics_in_mask(a, b, mask, px_area_ha=1.0, pixel_m=100.0)
    assert m["core_habitat"] <= m["habitat_remaining"]


# --- Integration: run the real script against the local inputs --------------

DEFAULT_INPUTS = [
    REPO / "docs" / "classification_2017.tif",
    REPO / "docs" / "classification_2025.tif",
    REPO / "data" / "study_areas" / "habitat_areas.geojson",
]
_inputs_present = all(p.exists() for p in DEFAULT_INPUTS)
needs_inputs = pytest.mark.skipif(
    not _inputs_present, reason="local rasters / study-area geometry not present"
)


def _run_to_csv(out_path: Path) -> dict:
    """Run the script and return {(study_area, metric): value_as_float}."""
    subprocess.run(
        [sys.executable, "-I", str(HERE / "habitat_loss.py"), "--out", str(out_path)],
        cwd=str(REPO), check=True, capture_output=True, text=True,
    )
    table = {}
    with open(out_path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            table[(r["study_area"], r["metric"])] = float(r["value"])
    return table


@needs_inputs
def test_output_invariants(tmp_path):
    table = _run_to_csv(tmp_path / "out.csv")
    areas = {area for area, _ in table}
    assert areas, "no rows produced"

    for area in areas:
        drivers = sum(table[(area, k)]
                      for k in ("driver_mining", "driver_farming", "driver_other"))
        # Drivers are shares of gross loss: exactly 100 when loss exists, else 0.
        assert drivers in (0.0, 100.0), f"{area} drivers sum to {drivers}"
        assert table[(area, "core_habitat")] <= table[(area, "habitat_remaining")] + 0.05, \
            f"{area}: core exceeds remaining"

    # The union rollup must dominate every region for additive area metrics.
    overall = hl.OVERALL_NAME
    regions = areas - {overall}
    if overall in areas and regions:
        for metric in ("habitat_remaining", "habitat_lost", "quarry_footprint"):
            biggest_region = max(table[(a, metric)] for a in regions)
            assert table[(overall, metric)] >= biggest_region - 0.05, \
                f"overall {metric} smaller than a single region"


@needs_inputs
def test_run_is_deterministic(tmp_path):
    a = tmp_path / "a.csv"
    b = tmp_path / "b.csv"
    _run_to_csv(a)
    _run_to_csv(b)
    assert a.read_text(encoding="utf-8") == b.read_text(encoding="utf-8")
