"""Read-only diagnostic for the Roomies session.

Prints what the pages actually show so a human can judge, instead of trusting a
keyword heuristic. Writes nothing, clicks nothing, submits nothing.

Run once after a manual login to confirm the session persisted, and again any
time read_listing starts reporting something surprising.
"""
import os
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/.claude/browser-profiles/roomies")

# Pages that should only render for a signed-in user. If these redirect to a
# login page, the session did not persist.
CANDIDATES = (
    "https://www.roomies.sg/",
    "https://www.roomies.sg/my-listings",
    "https://www.roomies.sg/dashboard",
    "https://www.roomies.sg/account",
    "https://www.roomies.sg/profile",
)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        PROFILE, channel="chrome", headless=False, no_viewport=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()

    for url in CANDIDATES:
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)
            status = resp.status if resp else "?"
            body = (page.inner_text("body") or "")[:600].replace("\n", " | ")
            print(f"\n=== {url}")
            print(f"    status={status}  final={page.url}")
            print(f"    text: {body}")
        except Exception as exc:
            print(f"\n=== {url}\n    ERROR {type(exc).__name__}: {exc}")

    names = sorted({c["name"] for c in ctx.cookies()})
    print(f"\ncookie names ({len(names)}): {names}")
    ctx.close()
