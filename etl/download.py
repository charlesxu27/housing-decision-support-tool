"""Optional downloads for offline / faster repeats. The API works without this."""

from __future__ import annotations

import json
import ssl
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "apps" / "api" / "data"
DATA.mkdir(parents=True, exist_ok=True)
CTX = ssl.create_default_context()

ACS_URL = (
    "https://api.census.gov/data/2023/acs/acs5"
    "?get=NAME,B19013_001E,B25064_001E,B25077_001E,B25002_001E,B25002_003E"
    "&for=tract:*&in=state:42+county:003"
)

ZONING = "https://data.wprdc.org/dataset/01773197-baba-4f5e-aa77-ae87a04afafc/resource/6127f35e-f36b-4a53-80b3-f4409609e9df/download/zoning.geojson"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "pgh-housing-advisor/0.1"})
    with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
        return r.read()


def main() -> None:
    print("Downloading ACS tracts for Allegheny County...")
    (DATA / "acs_tracts.json").write_bytes(fetch(ACS_URL))
    print("Saved", DATA / "acs_tracts.json")
    print("Live zoning/slope/flood/parcel queries do not require a local copy.")
    print("Done.")


if __name__ == "__main__":
    main()
