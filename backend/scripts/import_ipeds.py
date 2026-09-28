#!/usr/bin/env python3
"""Build the bundled ScholarBridge directory from the official IPEDS archive."""

import csv
import io
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse


YEAR = 2024
SOURCE_URL = f"https://nces.ed.gov/ipeds/datacenter/data/HD{YEAR}.zip"
OUTPUT = Path(__file__).resolve().parents[1] / "data/ipeds-directory.json"
OWNERSHIP = {"1": "Public", "2": "Private nonprofit", "3": "Private for-profit"}
LEVEL = {"1": "Four-year", "2": "Two-year", "3": "Less than two-year"}


def clean_url(value):
    value = (value or "").strip()
    if not value:
        return None
    if not value.startswith(("https://", "http://")):
        value = "https://" + value
    if not urlparse(value).hostname:
        return None
    return value


with tempfile.TemporaryDirectory() as temp_dir:
    archive_path = Path(temp_dir) / f"HD{YEAR}.zip"
    urllib.request.urlretrieve(SOURCE_URL, archive_path)

    with zipfile.ZipFile(archive_path) as archive:
        csv_name = next(name for name in archive.namelist() if name.endswith(".csv"))
        rows = csv.DictReader(io.TextIOWrapper(archive.open(csv_name), encoding="utf-8-sig"))
        institutions = []
        for row in rows:
            if row["CYACTIVE"] != "1" or row["OPENPUBL"] != "1":
                continue
            institutions.append({
                "id": int(row["UNITID"]),
                "name": row["INSTNM"].strip(),
                "city": row["CITY"].strip(),
                "state": row["STABBR"].strip(),
                "zip": row["ZIP"].strip(),
                "ownership": OWNERSHIP.get(row["CONTROL"], "Other"),
                "level": LEVEL.get(row["ICLEVEL"], "Not reported"),
                "degreeGranting": row["DEGGRANT"] == "1",
                "website": clean_url(row["WEBADDR"]),
                "applicationUrl": clean_url(row["APPLURL"]),
                "financialAidUrl": clean_url(row["FAIDURL"]),
            })

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps({
    "source": "U.S. Department of Education, National Center for Education Statistics, IPEDS",
    "sourceFile": f"HD{YEAR}.zip",
    "sourceUrl": SOURCE_URL,
    "year": YEAR,
    "activeStatusFilter": "CYACTIVE=1; OPENPUBL=1",
    "institutions": institutions,
}, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Wrote {len(institutions):,} active institutions to {OUTPUT}")