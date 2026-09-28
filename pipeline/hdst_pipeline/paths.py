"""Repository paths and configuration loading."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_DIR.parent

# Coordinate reference systems
WGS84 = "EPSG:4326"
METRIC_CRS = "EPSG:32617"  # UTM zone 17N, metres

TYPE_IDS = [
    "adu",
    "duplex_triplex",
    "townhome",
    "small_apartment",
    "large_apartment",
    "senior_accessible",
    "rehab_reuse",
    "detached_sf",
]

ZONING_STATUSES = [
    "by_right",
    "special_exception",
    "conditional_use",
    "not_permitted",
    "unknown",
]

BANDS = ["high", "medium", "low", "uncertain"]

USE_CLASSES = [
    "vacant",
    "sf_detached",
    "sf_attached",
    "two_family",
    "three_family",
    "multi_unit",
    "other",
]


@dataclass(frozen=True)
class Paths:
    repo_root: Path

    @property
    def pipeline(self) -> Path:
        return self.repo_root / "pipeline"

    @property
    def sources_yaml(self) -> Path:
        return self.pipeline / "sources.yaml"

    @property
    def model_yaml(self) -> Path:
        return self.pipeline / "config" / "model.yaml"

    @property
    def zoning_matrix_csv(self) -> Path:
        return self.pipeline / "zoning" / "pittsburgh_matrix.csv"

    @property
    def raw(self) -> Path:
        return self.repo_root / "data" / "raw"

    @property
    def processed(self) -> Path:
        return self.repo_root / "data" / "processed"

    @property
    def out(self) -> Path:
        return self.repo_root / "web" / "public" / "data"

    @property
    def fetch_log(self) -> Path:
        return self.raw / "fetch_log.json"

    def raw_dir(self, source_id: str) -> Path:
        return self.raw / source_id


DEFAULT_PATHS = Paths(REPO_ROOT)


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def load_sources(paths: Paths = DEFAULT_PATHS) -> list[dict[str, Any]]:
    return load_yaml(paths.sources_yaml)["sources"]


def load_model_config(paths: Paths = DEFAULT_PATHS) -> dict[str, Any]:
    return load_yaml(paths.model_yaml)


def config_hash(paths: Paths = DEFAULT_PATHS, extra: dict[str, Any] | None = None) -> str:
    """Stable hash of everything that determines the model output for fixed inputs."""
    from . import MODEL_VERSION

    h = hashlib.sha256()
    h.update(MODEL_VERSION.encode())
    for p in (paths.model_yaml, paths.sources_yaml, paths.zoning_matrix_csv):
        h.update(p.name.encode())
        h.update(p.read_bytes())
    if extra:
        h.update(json.dumps(extra, sort_keys=True).encode())
    return h.hexdigest()


def read_fetch_log(paths: Paths = DEFAULT_PATHS) -> dict[str, Any]:
    if paths.fetch_log.exists():
        return json.loads(paths.fetch_log.read_text(encoding="utf-8"))
    return {}
