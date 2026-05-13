# Extract Intent

Given the last 10 messages of a Hyve prospect chat, extract structured intent.

## Schema

```json
{
  "room_type": "premium" | "standard" | "master" | null,
  "budget_min": null | number,
  "budget_max": null | number,
  "move_in_date": "YYYY-MM-DD" | null,
  "lease_months": null | number,
  "location_prefs": ["jurong east", "lentor"],
  "pets": null | boolean,
  "cooking": null | boolean,
  "profile_notes": "free text — nationality, profession, household composition",
  "prospect_summary": "1-2 sentence brief in admin's voice, surfaced on the Kanban card",
  "name_self_reported": "string | null — name the prospect typed for themselves, separate from Beeper contact name",
  "pax": null | 1 | 2 | 3,
  "extracted_at": "<ISO>",
  "extraction_confidence": "high" | "medium" | "low"
}
```

## Rules

- Use `null` for any field not mentioned. Do NOT guess.
- Budget in SGD per month. Single number → `budget_max`.
- `room_type`: master = MBR, premium = PR with attached bath, standard = STD with shared bath. Unclear → null.
- `move_in_date` ISO. "next month" → relative to today. "ASAP" → today.
- `lease_months`: "1 year" → 12, "6 months" → 6, "as long as possible" → null.
- `location_prefs`: lowercase free-form ("lorong chuan", "near MRT").
- `pets`: true if cat/dog/pet mentioned; false if explicitly no pets; null otherwise.
- `name_self_reported`: capture the first name the prospect uses for themselves ("hi I'm Dirk" → "Dirk"). Null if they haven't introduced themselves.
- `pax`: 1 for single occupant, 2 for couple, 3 for trio/family. Null if not stated.
- `prospect_summary`: 1-2 short sentences gleaned FROM what the prospect said. Admin's voice (third-person, factual, no greetings). Example: "Couple from PH, ~1500 budget, eyeing CP master, July 1 move-in, cat owner." If nothing useful was said, use empty string "".
- `extraction_confidence`:
  - high: budget + move_in + room_type all present + unambiguous
  - medium: 1-2 fields
  - low: minimal info ("hi! still available?")

## Output

Return only the JSON object, no surrounding text.
