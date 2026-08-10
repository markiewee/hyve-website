"""Read-only: report which Roomies cookies survive a browser quit.

A cookie with no expiry is a SESSION cookie: Chrome discards it when the browser
closes, which silently logs you back out. That is indistinguishable from "the
login failed" unless you look, which is why this exists.
"""
import os
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/.claude/browser-profiles/roomies")

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(PROFILE, channel="chrome", headless=True)
    page = ctx.new_page()
    page.goto("https://www.roomies.sg/", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(1500)

    for c in sorted(ctx.cookies(), key=lambda c: c["name"]):
        session = c.get("expires", -1) in (-1, 0)
        kind = "SESSION (discarded on quit)" if session else "persistent"
        print(f'{c["name"]:28} {kind:28} domain={c["domain"]}')

    ctx.close()
