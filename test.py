#!/usr/bin/env python3
"""
TNAGRISNET Scheme Scraper - v4 FINAL
=====================================
Key findings from data analysis:
  1. postInputAngular has NO dedicated subsidy field.
     subsidy_en='/' is just the English/Tamil separator after HTML stripping.
     Subsidy info is embedded inside scheme_desc (where it exists).

  2. 2024-25 active schemes (IDs 163-180) have NULL descriptions in the master list.
     Their content must be backfilled from equivalent older-year schemes
     (e.g. KAVIADP 2024-25 <- KAVIADP 2023-24 which has full content).

  3. Component-level loop (postInputAngular) is DROPPED - it returns no new data.

  4. The raw API returns ALL scheme years. Active 2024-25 schemes = 17 total.
     Only 3 of those have description in the master list. 14 need backfill.

STRATEGY:
  Pass 1: Fetch getSchemes/A -> get all schemes
  Pass 2: Backfill null descriptions from older versions of same scheme
  Pass 3: Extract subsidy amounts from scheme_desc using regex
  Output: Clean JSON in Pillar 4 schema

USAGE:
  pip install requests
  python tnagrisnet_scraper.py
"""

import requests, json, re, sys

# ============================================================
SESSION_COOKIE = "907208b9c4a5748e40996fee771f327bbb7df27e"  # refresh if expired
OUTPUT        = "tnagrisnet_schemes_final.json"
RAW_OUTPUT    = "tnagrisnet_schemes_raw.json"
# ============================================================

BASE = "https://www.tnagrisnet.tn.gov.in/Scheme_master"
session = requests.Session()
session.cookies.set("ci_session", SESSION_COOKIE)
session.headers.update({
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": "https://www.tnagrisnet.tn.gov.in",
    "Referer": "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
})

# ── helpers ───────────────────────────────────────────────────────────────

def clean(text):
    if not text:
        return None
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = "\n".join(l.strip() for l in text.split("\n"))
    text = text.strip()
    return text or None

def split_docs(text):
    c = clean(text)
    if not c:
        return None
    parts = re.split(r"\n+|\d+\.\s*", c)
    docs = [p.strip() for p in parts if p.strip()]
    return docs or None

def extract_subsidy(desc):
    """Pull subsidy amounts from scheme description text."""
    if not desc:
        return None
    hits = re.findall(
        r"(?:Rs\.?\s*[\d,]+(?:\s*/\s*(?:Ha|Hectare|unit|farmer|acre|Nos?))?)"
        r"|(?:\d+\s*%\s*(?:subsidy|maan\w*))"
        r"|(?:(?:subsidy|assistance)\s+of\s+Rs\.?\s*[\d,]+)",
        desc, re.IGNORECASE
    )
    unique = list(dict.fromkeys(h.strip() for h in hits))   # dedupe, preserve order
    return " | ".join(unique) if unique else None

# ── fetch ─────────────────────────────────────────────────────────────────

def fetch_all():
    print("Fetching getSchemes/A ...")
    r = session.post(f"{BASE}/getSchemes/A", timeout=30)
    if r.status_code != 200 or not r.text.strip():
        print("FAILED — refresh the ci_session cookie.")
        sys.exit(1)
    data = r.json()
    print(f"Received {len(data)} total records.")
    with open(RAW_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data

# ── backfill map ──────────────────────────────────────────────────────────
# Maps active 2024-25 scheme_id -> best older scheme_id with richer content.
# Identified by matching Scheme_Name keywords across years.
BACKFILL_MAP = {
    # 2024-25 id  : older id with content
    "163": "163",  # NADP 2024-25   <- no older match; keep as-is
    "164": "164",  # FNSM 2024-25   <- no older match; keep as-is
    "165": "148",  # TN Millet Mission 2024-25 <- 2023-24 (has desc+eligibility)
    "167": "116",  # TNIAMP 2024-25 <- 2022-23 (has desc)
    "168": "136",  # SMSP 2024-25   <- 2023-24 (has partial)
    "171": "124",  # KAVIADP 2024-25 <- 2023-24 (full content)
    "172": "134",  # NMEO 2024-25   <- 2023-24 (full content)
    "173": "130",  # RAD-IFS 2024-25 <- 2023-24 (full content)
    "174": "131",  # PKVY 2024-25   <- 2023-24 cluster (full content)
    "175": "139",  # SADS 2024-25   <- 2023-24 (has content)
    "176": "153",  # CM MKMK 2024-25 <- scheme 153 (active, has content)
    "177": "177",  # Kuruvai 2024   <- no older match; keep as-is
    "179": "179",  # Unspent FNS    <- no match; keep as-is
    "180": "180",  # Unspent TRFA   <- no match; keep as-is
}

SKIP_FOR_PILLAR4 = {
    # Internal/admin schemes not useful for farmers
    "179",  # Unspent FNS (budget carry-forward)
    "180",  # Unspent TRFA (budget carry-forward)
}

# ── build index ───────────────────────────────────────────────────────────

def build_index(raw):
    """Dict of scheme_id -> raw record."""
    return {s["scheme_id"]: s for s in raw}

# ── main ──────────────────────────────────────────────────────────────────

def main():
    raw = fetch_all()
    idx = build_index(raw)

    # filter: active + not deleted + not internal skip list
    active = [
        s for s in raw
        if s.get("active") == "yes"
        and s.get("delete_status") != "yes"
        and s["scheme_id"] not in SKIP_FOR_PILLAR4
    ]
    print(f"Active usable schemes: {len(active)}")

    results = []
    backfilled = 0
    subsidy_found = 0

    for s in active:
        sid = s["scheme_id"]

        # ── try backfill if description is empty ──────────────────────────
        src = s
        if not clean(s.get("scheme_desc")) and sid in BACKFILL_MAP:
            older_id = BACKFILL_MAP[sid]
            if older_id != sid and older_id in idx:
                src = idx[older_id]
                backfilled += 1
                print(f"  Backfilled scheme {sid} from {older_id}: {src['Scheme_Name'][:50]}")

        desc_en   = clean(src.get("scheme_desc"))
        desc_ta   = clean(src.get("scheme_desc_tamil"))
        elig_en   = clean(src.get("eligibility"))
        elig_ta   = clean(src.get("eligibility_tamil"))
        docs_en   = split_docs(src.get("doc_req"))
        docs_ta   = split_docs(src.get("doc_req_tamil"))

        # ── extract subsidy from description ─────────────────────────────
        subsidy = extract_subsidy(desc_en)
        if subsidy:
            subsidy_found += 1

        entry = {
            "scheme_id":            f"TN-AGRI-{sid}",
            "source_scheme_id":     sid,
            "name_en":              clean(s.get("Scheme_Name")),
            "name_ta":              clean(s.get("Scheme_Name_Tamil")),
            "level":                "State",
            "department_en":        "Agriculture",
            "department_ta":        clean(s.get("dept_tamil")),
            "scheme_code":          s.get("scheme_code") or None,
            "year":                 s.get("year"),
            "benefit_amount":       subsidy,           # extracted from desc; null if not found
            "description_en":       desc_en,
            "description_ta":       desc_ta,
            "eligibility_rules":    elig_en,
            "eligibility_ta":       elig_ta,
            "documents_required":   docs_en,
            "documents_required_ta":docs_ta,
            "application_url":      "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
            "application_deadline": None,
            "state":                "Tamil Nadu",
            "active":               True,
            "content_backfilled_from": older_id if (not clean(s.get("scheme_desc")) and sid in BACKFILL_MAP and BACKFILL_MAP[sid] != sid) else None,
            "last_updated":         "2026-06-17",
            "source_url":           "https://www.tnagrisnet.tn.gov.in/home/schemes/en",
        }
        results.append(entry)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nDONE.")
    print(f"  Active schemes saved  : {len(results)}")
    print(f"  Descriptions backfilled: {backfilled}")
    print(f"  Subsidy amounts found : {subsidy_found}")
    print(f"  Schemes with null desc: {sum(1 for r in results if not r['description_en'])}")
    print(f"  Output                : {OUTPUT}")
    print(f"  Raw backup            : {RAW_OUTPUT}")
    print(f"\nNOTE: Schemes with null description have no content in the portal")
    print(f"at any year. These are 2024-25 programme shells pending data entry.")

if __name__ == "__main__":
    main()