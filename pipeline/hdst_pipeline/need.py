"""NEED model: household-vs-stock gaps -> per-type scores -> county tertile bands.

Inputs are the ACS tract frame (values or None per measure plus ``moe_flags``).
A type's band is ``uncertain`` when any measure feeding a non-zero weight is
missing or flagged. Scores are min-max scaled gaps, weighted and normalised.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .paths import TYPE_IDS

# gap id -> measures it depends on
GAP_INPUTS: dict[str, list[str]] = {
    "small": ["hh_1_2", "br_0_1", "br_2"],
    "large": ["hh_5_plus", "br_3_plus", "overcrowded"],
    "senior": ["senior_alone"],
    "burden": ["cost_burdened_renters"],
    "vacancy": ["other_vacant_share"],
    "tight": ["vacant_share"],
    "renter": ["renter_share"],
}


def _v(row: pd.Series, key: str) -> float | None:
    x = row.get(key)
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return float(x)


def raw_gaps(row: pd.Series) -> dict[str, float | None]:
    """Unscaled gap values for one tract; None when an input is missing."""
    g: dict[str, float | None] = {}
    a, b, c = _v(row, "hh_1_2"), _v(row, "br_0_1"), _v(row, "br_2")
    g["small"] = None if None in (a, b, c) else a - (b + c)
    a, b, c = _v(row, "hh_5_plus"), _v(row, "br_3_plus"), _v(row, "overcrowded")
    g["large"] = None if None in (a, b, c) else (a - b) + c
    g["senior"] = _v(row, "senior_alone")
    g["burden"] = _v(row, "cost_burdened_renters")
    g["vacancy"] = _v(row, "other_vacant_share")
    v = _v(row, "vacant_share")
    g["tight"] = None if v is None else 1.0 - v
    g["renter"] = _v(row, "renter_share")
    return g


def min_max(series: pd.Series) -> pd.Series:
    s = series.astype(float)
    lo, hi = s.min(skipna=True), s.max(skipna=True)
    if pd.isna(lo) or pd.isna(hi) or hi - lo == 0:
        return pd.Series(np.where(s.notna(), 0.0, np.nan), index=s.index)
    return (s - lo) / (hi - lo)


def tertile_bands(scores: pd.Series) -> pd.Series:
    """'high' for the top third, 'medium' middle, 'low' bottom; NaN -> 'uncertain'."""
    s = scores.astype(float)
    valid = s.dropna()
    out = pd.Series("uncertain", index=s.index, dtype=object)
    if len(valid) == 0:
        return out
    q1, q2 = valid.quantile(1 / 3), valid.quantile(2 / 3)
    out[valid.index] = np.where(valid > q2, "high", np.where(valid > q1, "medium", "low"))
    return out


def compute_need(acs: pd.DataFrame, weights: dict[str, dict[str, float]]) -> pd.DataFrame:
    """Return frame indexed by geoid with ``need_<type>`` bands and ``score_<type>``.

    ``acs`` must contain the measure columns and a ``moe_flags`` list column.
    """
    gaps = pd.DataFrame([raw_gaps(r) for _, r in acs.iterrows()], index=acs.index)
    scaled = gaps.apply(min_max)
    out = pd.DataFrame(index=acs.index)
    flags = acs["moe_flags"].apply(lambda v: set(v) if isinstance(v, (list, set, tuple)) else set())
    for t in TYPE_IDS:
        w = {k: float(v) for k, v in weights.get(t, {}).items() if float(v) != 0}
        if not w:
            out[f"score_{t}"] = np.nan
            out[f"need_{t}"] = "uncertain"
            continue
        total_w = sum(w.values())
        score = sum(scaled[g] * (wt / total_w) for g, wt in w.items())
        # uncertain when any input measure to a weighted gap is missing or flagged
        inputs = sorted({m for g in w for m in GAP_INPUTS[g]})
        missing = acs[inputs].isna().any(axis=1)
        flagged = flags.apply(lambda f: bool(f & set(inputs)))
        score = score.where(~(missing | flagged), np.nan)
        out[f"score_{t}"] = score
        out[f"need_{t}"] = tertile_bands(score)
    return out
