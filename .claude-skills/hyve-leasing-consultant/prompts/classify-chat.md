# Classify Chat

Decide whether the chat is a `prospect`, `tenant`, `agent`, or `internal`.

## Signals

**Tenant**: phone matches an active row in `tenant_profiles` table.
**Internal**: phone matches Mark (+6581333757), Liv, or a captain.
**Agent** (one or more must hold):
- Latest message matches: `/I'?m .{2,40} received your enquiry from PropertyGuru/i`
- Message mentions: PropNex, Huttons, OrangeTee, ERA, "my PA reached out", "marketing your unit", "pool of tenants"
- Sender name on WhatsApp profile contains: Real Estate, Property, RE, Realty

**Prospect**: default.

## Output

One word: `prospect`, `tenant`, `agent`, or `internal`.
