#!/usr/bin/env python3
"""
NEXERA · sync-partials.py
-------------------------------------------------------------------------
Copies partials/header.html and partials/footer.html into every page, so the
navigation and footer are edited in ONE place yet ship as plain static HTML
(good for SEO and for visitors with JavaScript off).

Each page marks where the partial belongs with two comments:

    <!-- @partial header:start -->  ...generated...  <!-- @partial header:end -->
    <!-- @partial footer:start -->  ...generated...  <!-- @partial footer:end -->

Usage (run from the project folder):   python3 tools/sync-partials.py
Nothing outside those comment pairs is ever touched.
"""
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTIALS = {name: (ROOT / "partials" / f"{name}.html").read_text(encoding="utf-8")
            for name in ("header", "footer")}


def mark_current_page(header_html: str, page: str) -> str:
    """Add aria-current="page" to the nav link that points at this page."""
    pattern = rf'(<a href="{re.escape(page)}")(?! aria-current)'
    return re.sub(pattern, r'\1 aria-current="page"', header_html, count=1)


def build_block(name: str, page: str) -> str:
    html = PARTIALS[name].strip("\n")
    if name == "header":
        html = mark_current_page(html, page)
    if name == "footer":
        html = html.replace("{{year}}", str(date.today().year))
    return f"<!-- @partial {name}:start -->\n{html}\n<!-- @partial {name}:end -->"


def main() -> None:
    changed = 0
    for path in sorted(ROOT.glob("*.html")):
        text = original = path.read_text(encoding="utf-8")
        for name in PARTIALS:
            pattern = re.compile(rf"<!-- @partial {name}:start -->.*?<!-- @partial {name}:end -->", re.S)
            if pattern.search(text):
                text = pattern.sub(lambda _m: build_block(name, path.name), text)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
            print(f"updated  {path.name}")
    print(f"done. {changed} page(s) updated.")


if __name__ == "__main__":
    main()
