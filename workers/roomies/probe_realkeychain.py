"""Same probe, but WITHOUT Playwright's --use-mock-keychain.

Chrome on macOS encrypts cookie VALUES with a key held in the login Keychain;
cookie names stay in plaintext. Playwright adds --use-mock-keychain by default
to avoid Keychain prompts, which means a profile whose cookies were written by
real Chrome decrypts to garbage. The symptom is a session cookie that is clearly
present and yet the site treats you as signed out.

If this script reports signed in and the normal probe reports signed out, that
difference IS the diagnosis.
"""
import os
from playwright.sync_api import sync_playwright

PROFILE = os.path.expanduser("~/.claude/browser-profiles/roomies")

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        PROFILE,
        channel="chrome",
        headless=False,
        no_viewport=True,
        ignore_default_args=["--use-mock-keychain"],
    )
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://www.roomies.sg/dashboard", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2500)

    bounced = "/login" in page.url
    print(f"final url : {page.url}")
    print(f"verdict   : {'SIGNED OUT (bounced to login)' if bounced else 'SIGNED IN'}")
    print(f"body head : {(page.inner_text('body') or '')[:220]}")

    ctx.close()
