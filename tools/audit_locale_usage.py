#!/usr/bin/env python3
"""
Audit `locales/en.default.json` usage with code and runtime heuristics.

Outputs:
- `tools/locale-audit-report.json`
- `tools/locale-audit-report.csv`

This is intentionally conservative:
- `used_exact`: key path appears in repo code/templates.
- `dynamic_risk`: namespace is known to be consumed dynamically.
- `builtin_risk`: key looks like a Shopify/platform or component-driven string.
- `runtime_value_seen`: the translated string was found in fetched storefront HTML.
- `candidate_unused`: no strong signal found.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List
from urllib.error import URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
LOCALE_FILE = ROOT / "locales" / "en.default.json"
JSON_REPORT = ROOT / "tools" / "locale-audit-report.json"
CSV_REPORT = ROOT / "tools" / "locale-audit-report.csv"

SCAN_SUFFIXES = {".liquid", ".js", ".ts", ".json"}
IGNORE_DIRS = {".git", ".cursor", "node_modules", "locales", "tools"}


DYNAMIC_RISK_PREFIXES = (
    "products.reviews.country_names.",
    "products.product.variant_drawer_text.",
)

BUILTIN_RISK_PREFIXES = (
    "shopify.",
    "customer_accounts.",
    "customer.",
    "recipient.",
    "gift_cards.",
    "general.password_page.",
    "general.account.",
    "products.product.pickup_availability.",
    "products.product.media.",
    "products.product.quantity.",
    "products.product.price.",
)

BUILTIN_RISK_KEYS = {
    "products.modal.label",
    "products.product.value_unavailable",
    "products.product.variant_sold_out_or_unavailable",
    "products.product.video_exit_message",
    "products.product.view_in_3d",
    "products.product.xr_button",
    "products.product.xr_button_label",
    "general.share.close",
    "general.share.copy_to_clipboard",
    "general.share.share_url",
    "general.slider.of",
    "general.slider.next_slide",
    "general.slider.previous_slide",
    "general.slider.name",
}


@dataclass
class KeyAudit:
    key: str
    value: str
    used_exact: bool
    exact_files: List[str]
    parent_used: bool
    dynamic_risk: bool
    builtin_risk: bool
    runtime_value_seen: bool
    runtime_pages: List[str]
    status: str
    notes: List[str]


def load_locale() -> Dict[str, object]:
    raw = LOCALE_FILE.read_text()
    return json.loads(raw[raw.find("{"):])


def flatten(obj: object, prefix: str = "") -> Dict[str, str]:
    out: Dict[str, str] = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            dotted = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                out.update(flatten(value, dotted))
            else:
                out[dotted] = value
    return out


def iter_source_files() -> Iterable[Path]:
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORE_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in SCAN_SUFFIXES:
            continue
        yield path


def load_sources() -> Dict[Path, str]:
    contents: Dict[Path, str] = {}
    for path in iter_source_files():
        try:
            contents[path] = path.read_text(errors="ignore")
        except OSError:
            contents[path] = ""
    return contents


def path_is_dynamic_risk(key: str) -> bool:
    return key.startswith(DYNAMIC_RISK_PREFIXES)


def path_is_builtin_risk(key: str) -> bool:
    return key.startswith(BUILTIN_RISK_PREFIXES) or key in BUILTIN_RISK_KEYS


def fetch(url: str) -> str:
    with urlopen(url) as response:
        return response.read().decode("utf-8", "ignore")


def collect_runtime_pages() -> Dict[str, str]:
    pages: Dict[str, str] = {}

    seeds = [
        "https://voldt.it/",
        "https://voldt.it/cart",
        "https://voldt.it/collections/all",
        "https://voldt.it/search?q=zzzzunlikelyquery&type=product&page=1",
        "https://voldt.it/blogs/notizie",
        "https://voldt.it/pages/faq",
        "https://voldt.it/pages/diventare-partner",
        "https://voldt.it/pages/reso-gratuito",
    ]

    for url in seeds:
        try:
            pages[url] = fetch(url)
        except URLError:
            pass

    home = pages.get("https://voldt.it/", "")
    product_paths = sorted(set(re.findall(r"/products/[^\"?#]+", home)))[:8]
    page_paths = sorted(set(re.findall(r"/pages/[^\"?#]+", home)))[:8]

    blog_index = pages.get("https://voldt.it/blogs/notizie", "")
    article_paths = sorted(set(re.findall(r"/blogs/[^\"?#]+/[^\"?#]+", blog_index)))[:8]

    for path in product_paths:
        url = f"https://voldt.it{path}"
        try:
            pages[url] = fetch(url)
        except URLError:
            continue

    for path in page_paths + article_paths:
        url = f"https://voldt.it{path}"
        try:
            pages[url] = fetch(url)
        except URLError:
            continue

    return pages


def exact_hits_for_key(key: str, sources: Dict[Path, str]) -> List[str]:
    hits: List[str] = []
    for path, content in sources.items():
        if key in content:
            hits.append(str(path.relative_to(ROOT)))
    return hits


def classify(
    key: str,
    exact_files: List[str],
    dynamic_risk: bool,
    builtin_risk: bool,
    runtime_value_seen: bool,
    parent_used: bool,
) -> str:
    if exact_files:
        return "used_exact"
    if parent_used:
        return "used_via_parent"
    if dynamic_risk:
        return "dynamic_risk"
    if builtin_risk:
        return "builtin_risk"
    if runtime_value_seen:
        return "runtime_value_seen"
    return "candidate_unused"


def build_notes(
    key: str,
    exact_files: List[str],
    dynamic_risk: bool,
    builtin_risk: bool,
    runtime_pages: List[str],
    parent_used: bool,
) -> List[str]:
    notes: List[str] = []
    if exact_files:
        notes.append("Exact key path found in source files")
    if parent_used:
        notes.append("Plural child is covered by parent key usage")
    if dynamic_risk:
        notes.append("Namespace is known to be consumed dynamically")
    if builtin_risk:
        notes.append("Looks like a Shopify/platform or built-in component key")
    if runtime_pages:
        notes.append("Translated value found in fetched storefront HTML")
    if not notes:
        notes.append("No exact repo hit or runtime signal found")
    return notes


def main() -> int:
    locale = load_locale()
    flat = flatten(locale)
    sources = load_sources()
    runtime_pages = collect_runtime_pages()

    audits: List[KeyAudit] = []
    exact_hits_cache: Dict[str, List[str]] = {}

    def cached_exact_hits(path: str) -> List[str]:
        if path not in exact_hits_cache:
            exact_hits_cache[path] = exact_hits_for_key(path, sources)
        return exact_hits_cache[path]

    for key, value in sorted(flat.items()):
        exact_files = cached_exact_hits(key)
        dynamic_risk = path_is_dynamic_risk(key)
        builtin_risk = path_is_builtin_risk(key)
        parent_used = False
        if key.endswith(".one") or key.endswith(".other"):
            parent_key = key.rsplit(".", 1)[0]
            if cached_exact_hits(parent_key):
                parent_used = True

        pages_with_value: List[str] = []
        if isinstance(value, str) and value and "{{" not in value:
            for page, html in runtime_pages.items():
                if value in html:
                    pages_with_value.append(page)

        status = classify(
            key=key,
            exact_files=exact_files,
            dynamic_risk=dynamic_risk,
            builtin_risk=builtin_risk,
            runtime_value_seen=bool(pages_with_value),
            parent_used=parent_used,
        )

        audits.append(
            KeyAudit(
                key=key,
                value=value,
                used_exact=bool(exact_files),
                exact_files=exact_files,
                parent_used=parent_used,
                dynamic_risk=dynamic_risk,
                builtin_risk=builtin_risk,
                runtime_value_seen=bool(pages_with_value),
                runtime_pages=pages_with_value,
                status=status,
                notes=build_notes(
                    key=key,
                    exact_files=exact_files,
                    dynamic_risk=dynamic_risk,
                    builtin_risk=builtin_risk,
                    runtime_pages=pages_with_value,
                    parent_used=parent_used,
                ),
            )
        )

    summary = defaultdict(int)
    for audit in audits:
        summary[audit.status] += 1

    JSON_REPORT.write_text(
        json.dumps(
            {
                "summary": dict(summary),
                "runtime_pages_scanned": list(runtime_pages.keys()),
                "audits": [asdict(audit) for audit in audits],
            },
            indent=2,
            ensure_ascii=False,
        )
    )

    with CSV_REPORT.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "key",
                "status",
                "value",
                "used_exact",
                "dynamic_risk",
                "builtin_risk",
                "runtime_value_seen",
                "exact_files",
                "runtime_pages",
                "notes",
            ]
        )
        for audit in audits:
            writer.writerow(
                [
                    audit.key,
                    audit.status,
                    audit.value,
                    audit.used_exact,
                    audit.dynamic_risk,
                    audit.builtin_risk,
                    audit.runtime_value_seen,
                    "; ".join(audit.exact_files),
                    "; ".join(audit.runtime_pages),
                    "; ".join(audit.notes),
                ]
            )

    print(json.dumps({"summary": dict(summary), "runtime_pages": list(runtime_pages.keys())}, indent=2))
    print(f"Wrote {JSON_REPORT.relative_to(ROOT)}")
    print(f"Wrote {CSV_REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
