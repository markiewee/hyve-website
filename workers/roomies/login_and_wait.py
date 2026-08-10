"""Open the Roomies login page in the worker's own profile and wait for a human.

Why this exists rather than "just open Chrome and log in": launching Chrome
separately and then pointing Playwright at the same profile afterwards has too
many ways to fail quietly (profile locks, a second instance falling back to a
throwaway profile, keychain differences, or simply logging in on the wrong
machine). Here the SAME browser process that the worker will use is the one the
human types into, so if the login works at all, it works for the worker.

The script never types credentials. It opens the page, watches, and reports.
It polls a page that only renders for a signed-in user, so "signed in" is a
fact about the site's behaviour and not a guess about the page text.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/.claude/browser-profiles/roomies")
LOGIN = "https://www.roomies.sg/login"
GATED = "https://www.roomies.sg/dashboard"   # redirects to /login unless signed in
WAIT_MINUTES = 10


def signed_in(page) -> bool:
    page.goto(GATED, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(1200)
    return "/login" not in page.url


with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        PROFILE, channel="chrome", headless=False, no_viewport=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(LOGIN, wait_until="domcontentloaded", timeout=45000)
    page.bring_to_front()

    print(f"WAITING: log in in the window now. Polling for up to {WAIT_MINUTES} min.", flush=True)

    deadline = time.time() + WAIT_MINUTES * 60
    ok = False
    while time.time() < deadline:
        time.sleep(15)
        try:
            # Only check the gated page; do not disturb a login form mid-typing
            # by navigating away from it more often than necessary.
            probe = ctx.new_page()
            probe.goto(GATED, wait_until="domcontentloaded", timeout=30000)
            probe.wait_for_timeout(1200)
            here = probe.url
            probe.close()
            print(f"  poll: {here}", flush=True)
            if "/login" not in here:
                ok = True
                break
        except Exception as exc:
            print(f"  poll error: {type(exc).__name__}: {exc}", flush=True)

    if ok:
        # Close cleanly so Chrome flushes the cookie store to disk.
        ctx.close()
        print("RESULT: SIGNED IN, session stored in the worker profile.", flush=True)
        sys.exit(0)

    ctx.close()
    print("RESULT: TIMED OUT, still signed out.", flush=True)
    sys.exit(1)
