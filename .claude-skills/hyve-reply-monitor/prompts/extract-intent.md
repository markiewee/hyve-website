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
- `extraction_confidence`:
  - high: budget + move_in + room_type all present + unambiguous
  - medium: 1-2 fields
  - low: minimal info ("hi! still available?")

## Output

Return only the JSON object, no surrounding text.
