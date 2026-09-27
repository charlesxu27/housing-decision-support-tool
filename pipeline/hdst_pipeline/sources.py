"""Download pinned sources into data/raw/<id>/ with resume, caching, and a fetch log.

The fetch log (data/raw/fetch_log.json) records, per source, the resolved URL(s),
local file(s), sha256, byte size, and retrieval timestamp so the manifest can
carry provenance without re-downloading.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

from .paths import DEFAULT_PATHS, Paths, load_sources, read_fetch_log

USER_AGENT = "hdst-pipeline/0.1 (+https://github.com/housing-decision-support-tool)"
CHUNK = 1 << 20


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def log(msg: str) -> None:
    print(f"[fetch] {msg}", file=sys.stderr, flush=True)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    return s


def download(url: str, dest: Path, session: requests.Session | None = None, retries: int = 3) -> Path:
    """Download ``url`` to ``dest`` with resume via a ``.part`` file. Skips when ``dest`` exists."""
    if dest.exists() and dest.stat().st_size > 0:
        log(f"cached {dest.name} ({dest.stat().st_size:,} bytes)")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    session = session or _session()
    for attempt in range(1, retries + 1):
        headers: dict[str, str] = {}
        mode = "wb"
        have = part.stat().st_size if part.exists() else 0
        if have > 0:
            headers["Range"] = f"bytes={have}-"
            mode = "ab"
        try:
            with session.get(url, headers=headers, stream=True, timeout=(30, 300)) as r:
                if r.status_code == 416:  # already complete
                    break
                if have and r.status_code != 206:
                    have, mode = 0, "wb"  # server ignored range: restart
                r.raise_for_status()
                total = r.headers.get("Content-Length")
                log(f"GET {url} -> {dest.name}" + (f" (resume @ {have:,})" if have else ""))
                done = have
                last = time.time()
                with part.open(mode) as fh:
                    for block in r.iter_content(CHUNK):
                        fh.write(block)
                        done += len(block)
                        if time.time() - last > 5:
                            last = time.time()
                            if total:
                                log(f"  {dest.name}: {done:,}/{int(total) + have:,} bytes")
                            else:
                                log(f"  {dest.name}: {done:,} bytes")
            break
        except (requests.RequestException, OSError) as exc:
            log(f"  attempt {attempt}/{retries} failed: {exc}")
            if attempt == retries:
                raise
            time.sleep(2 * attempt)
    part.rename(dest)
    log(f"saved {dest.name} ({dest.stat().st_size:,} bytes)")
    return dest


def _record(files: Iterable[Path], urls: list[str]) -> dict[str, Any]:
    files = list(files)
    return {
        "urls": urls,
        "files": [str(f.relative_to(DEFAULT_PATHS.repo_root)) if f.is_relative_to(DEFAULT_PATHS.repo_root) else str(f) for f in files],
        "sha256": [sha256_of(f) for f in files],
        "bytes": [f.stat().st_size for f in files],
        "retrievedAt": utcnow(),
        "available": True,
        "error": None,
    }


def fetch_http(src: dict[str, Any], out_dir: Path, session: requests.Session) -> dict[str, Any]:
    f = src["fetch"]
    url, filename = f["url"], f["filename"]
    try:
        head = session.head(url, allow_redirects=True, timeout=30)
        if head.status_code == 404 and f.get("fallbackUrl"):
            log(f"{src['id']}: {url} returned 404; falling back to {f['fallbackUrl']}")
            url, filename = f["fallbackUrl"], f["fallbackFilename"]
    except requests.RequestException:
        pass
    dest = download(url, out_dir / filename, session)
    rec = _record([dest], [url])
    if url != f["url"]:
        rec["fallbackUsed"] = True
    return rec


def fetch_http_files(src: dict[str, Any], out_dir: Path, session: requests.Session) -> dict[str, Any]:
    files, urls = [], []
    for item in src["fetch"]["files"]:
        files.append(download(item["url"], out_dir / item["filename"], session))
        urls.append(item["url"])
    return _record(files, urls)


def fetch_acs_tables(src: dict[str, Any], out_dir: Path, session: requests.Session) -> dict[str, Any]:
    f = src["fetch"]
    files, urls = [], []
    for table in f["tables"]:
        url = f["urlTemplate"].format(table_lower=table.lower(), table=table)
        files.append(download(url, out_dir / f"acsdt5y2024-{table.lower()}.dat", session))
        urls.append(url)
    return _record(files, urls)


def fetch_arcgis_query(src: dict[str, Any], out_dir: Path, session: requests.Session) -> dict[str, Any]:
    f = src["fetch"]
    dest = out_dir / f["filename"]
    if dest.exists() and dest.stat().st_size > 0:
        log(f"cached {dest.name}")
        return _record([dest], [f["url"]])
    out_dir.mkdir(parents=True, exist_ok=True)
    count = session.get(
        f["url"], params={"where": f["where"], "returnCountOnly": "true", "f": "json"}, timeout=60
    ).json()["count"]
    log(f"{src['id']}: {count} features to page through")
    page, offset, features = int(f.get("pageSize", 1000)), 0, []
    min_page = 25

    def fetch_page(off: int, size: int) -> list[dict]:
        params = {
            "where": f["where"],
            "outFields": f["outFields"],
            "outSR": 4326,
            "f": "geojson",
            "geometryPrecision": 7,
            "resultOffset": off,
            "resultRecordCount": size,
            "orderByFields": "OBJECTID",
        }
        last_exc: Exception | None = None
        for attempt in range(1, 3):
            try:
                r = session.get(f["url"], params=params, timeout=(30, 300))
                r.raise_for_status()
                body = r.json()
                if "error" in body:
                    raise RuntimeError(body["error"])
                return body.get("features", [])
            except (requests.RequestException, ValueError, RuntimeError) as exc:
                last_exc = exc
                log(f"  page @ {off} x{size} attempt {attempt} failed: {exc}")
                time.sleep(2 * attempt)
        if size <= min_page:
            raise RuntimeError(f"page @ {off} x{size} failed repeatedly: {last_exc}")
        # server choked on a large page (often one huge polygon): split it
        half = size // 2
        return fetch_page(off, half) + fetch_page(off + half, size - half)

    while offset < count:
        size = min(page, count - offset)
        got = fetch_page(offset, size)
        features.extend(got)
        offset += size
        log(f"  {len(features)}/{count}")
        if not got:
            break
    fc = {"type": "FeatureCollection", "features": features}
    tmp = dest.with_suffix(".part")
    tmp.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    tmp.rename(dest)
    rec = _record([dest], [f["url"] + "?where=" + f["where"]])
    rec["featureCount"] = len(features)
    return rec


def resolve_wprdc_latest_zip(dataset: str, name_pattern: str, session: requests.Session) -> dict[str, Any]:
    r = session.get("https://data.wprdc.org/api/3/action/package_show", params={"id": dataset}, timeout=60)
    r.raise_for_status()
    resources = r.json()["result"]["resources"]
    rx = re.compile(name_pattern)
    best = None
    for res in resources:
        if (res.get("format") or "").upper() != "ZIP":
            continue
        m = rx.search(res.get("name") or "")
        if not m:
            continue
        key = (m.group(1), res.get("last_modified") or "")
        if best is None or key > best[0]:
            best = (key, res)
    if best is None:
        raise RuntimeError(f"no ZIP resource in {dataset} matched {name_pattern}")
    return best[1]


def fetch_wprdc_latest_zip(src: dict[str, Any], out_dir: Path, session: requests.Session) -> dict[str, Any]:
    f = src["fetch"]
    res = resolve_wprdc_latest_zip(f["dataset"], f["namePattern"], session)
    url = res["url"]
    filename = url.rsplit("/", 1)[-1]
    dest = download(url, out_dir / filename, session)
    rec = _record([dest], [url])
    rec["resourceId"] = res["id"]
    rec["resourceName"] = res["name"]
    rec["resourceLastModified"] = res.get("last_modified")
    return rec


def fetch_local_optional(src: dict[str, Any], out_dir: Path, session: requests.Session) -> dict[str, Any]:
    pattern = src["fetch"].get("pattern", "*")
    files = sorted(out_dir.glob(pattern)) if out_dir.exists() else []
    if not files:
        log(f"{src['id']}: optional source not present under {out_dir} (expected {pattern}); continuing without it")
        return {
            "urls": [],
            "files": [],
            "sha256": [],
            "bytes": [],
            "retrievedAt": utcnow(),
            "available": False,
            "error": f"user-supplied file matching {pattern} not found in {out_dir.relative_to(DEFAULT_PATHS.repo_root)}",
        }
    rec = _record(files, [src["resourceUrl"]])
    rec["userSupplied"] = True
    return rec


FETCHERS = {
    "http": fetch_http,
    "http_files": fetch_http_files,
    "acs_tables": fetch_acs_tables,
    "arcgis_query": fetch_arcgis_query,
    "wprdc_latest_zip": fetch_wprdc_latest_zip,
    "local_optional": fetch_local_optional,
}


def fetch_all(paths: Paths = DEFAULT_PATHS, only: list[str] | None = None) -> dict[str, Any]:
    sources = load_sources(paths)
    log_data = read_fetch_log(paths)
    session = _session()
    paths.raw.mkdir(parents=True, exist_ok=True)
    for src in sources:
        sid = src["id"]
        if only and sid not in only:
            continue
        out_dir = paths.raw_dir(sid)
        prior = log_data.get(sid)
        if prior and prior.get("available") and all((paths.repo_root / p).exists() for p in prior.get("files", [])):
            log(f"{sid}: already fetched ({prior['retrievedAt']}); skipping")
            continue
        try:
            rec = FETCHERS[src["fetch"]["kind"]](src, out_dir, session)
        except Exception as exc:  # noqa: BLE001 - we record and continue
            log(f"{sid}: FAILED: {exc}")
            rec = {
                "urls": [],
                "files": [],
                "sha256": [],
                "bytes": [],
                "retrievedAt": utcnow(),
                "available": False,
                "error": str(exc),
            }
        log_data[sid] = rec
        paths.fetch_log.write_text(json.dumps(log_data, indent=2), encoding="utf-8")
    return log_data
