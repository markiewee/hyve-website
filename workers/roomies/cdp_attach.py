"""Attach to an ALREADY-RUNNING Chrome over the DevTools protocol.

This is the model Mark asked about: one browser stays open and logged in, and
any tool attaches to it rather than launching its own. It removes the entire
class of problems we hit trying to hand a profile between a human's Chrome and
Playwright's: no profile lock fight, no second instance falling back to a
throwaway profile, no question about which window was typed into. Whatever the
human sees is literally what the tool sees, because it is one browser.

Requires Chrome started with --remote-debugging-port=9222.
"""
import sys
from playwright.sync_api import sync_playwright

CDP = "http://127.0.0.1:9222"
GATED = "https://www.roomies.sg/dashboard"   # redirects to /login unless signed in

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(CDP)
    ctx = browser.contexts[0]
    print(f"attached: {len(browser.contexts)} context(s), {len(ctx.pages)} page(s)")
    for pg in ctx.pages:
        print(f"  open tab: {pg.url}")

    page = ctx.new_page()
    page.goto(GATED, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(1500)
    signed_in = "/login" not in page.url
    print(f"final url : {page.url}")
    print(f"verdict   : {'SIGNED IN' if signed_in else 'SIGNED OUT (bounced to login)'}")
    page.close()

    # Leave the browser running. Closing it here would defeat the whole point.
    browser.close()   # detaches the CDP connection only
    sys.exit(0 if signed_in else 1)
