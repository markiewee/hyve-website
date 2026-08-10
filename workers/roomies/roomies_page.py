"""Roomies-specific page reading. The ONLY file that knows Roomies exists.

Exposes one function used by the worker: read_listing(page, url) -> observed.
It never edits anything. The apply() half of the contract is deliberately
absent until Mark retires his 9 Aug 2026 Chrome-extension-only rule for Roomies.

Spec: docs/integrations/channel-worker-contract-v1.md section 11.

WARNING ON SELECTORS
--------------------
Every selector below is an educated guess. Nobody has yet opened a logged-in
Roomies listing page with this code. They MUST be checked against the real
markup before this is trusted, because a selector that silently matches nothing
looks exactly like a listing with no title, and reporting a wrong observation is
worse than reporting an error. verify_selectors() exists for that check and
raises rather than guessing.
"""
from datetime import datetime, timezone

SIGNED_OUT_MARKERS = ("log in", "sign in", "create an account", "sign up")
UNAVAILABLE_MARKERS = ("unavailable", "no longer available", "listing removed", "deactivated")

TITLE_SELECTORS = ("h1", "[data-testid='listing-title']", ".listing-title")


class SessionExpired(RuntimeError):
    """The page showed a login wall rather than our listing."""


class PageShapeUnknown(RuntimeError):
    """The page loaded but nothing we rely on was found. Never guess from this."""


def _title(page):
    for sel in TITLE_SELECTORS:
        el = page.query_selector(sel)
        if el:
            text = (el.inner_text() or "").strip()
            if text:
                return text
    return None


def read_listing(page, url: str) -> dict:
    """Load a listing and report what it ACTUALLY says. Never what we intended."""
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(1500)

    body = (page.inner_text("body") or "")[:6000].lower()

    if any(m in body for m in SIGNED_OUT_MARKERS):
        raise SessionExpired(f"login wall at {url}")

    title = _title(page)
    if title is None:
        # Refuse to invent an observation. An empty headline reported as fact
        # would read as drift and could trigger an edit against a page we did
        # not actually understand.
        raise PageShapeUnknown(f"no title found at {url}; selectors need checking")

    # Roomies has no availability field. A listing is live or it is not, so "on"
    # has to be read off whatever wording the page uses to say so.
    is_on = not any(m in body for m in UNAVAILABLE_MARKERS)

    return {
        "on": is_on,
        "headline": title,
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }


def verify_selectors(page, url: str) -> dict:
    """Run once by a human against a real listing before trusting read_listing.

    Reports which selectors matched rather than asserting the code is correct.
    """
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(1500)
    return {
        "url": page.url,
        "title_selector_hits": {s: bool(page.query_selector(s)) for s in TITLE_SELECTORS},
        "title_read": _title(page),
        "body_head": (page.inner_text("body") or "")[:400],
    }
