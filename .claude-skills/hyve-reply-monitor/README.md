# hyve-reply-monitor — Quickstart

## First-run dry mode

```
> hyve sweep --dry
```

Drafts everything, no sends, no DB writes. Eyeball matches + drafts. Iterate `prompts/*.md` until matches feel right.

## Going live

```
> hyve sweep
```

Each prospect is presented one-by-one for approval.

## Monitor pipeline

https://lazybee.sg/portal/admin/leads

Or local: http://localhost:5173/portal/admin/leads

## Common operations

- Sweep last 24h: `hyve sweep --since=24h`
- Cron: `/loop 30m /hyve-reply-monitor`
- Force re-classify a chat: edit card in `/portal/admin/leads`
