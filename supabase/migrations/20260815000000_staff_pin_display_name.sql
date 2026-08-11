-- Who is holding this PIN, in a form you can greet.
--
-- staff_pins.label is written for the admin list: "Mark, owner", "Lili,
-- Awehome (集好家)". It says who and why, which is right for an audit view and
-- wrong for a greeting. Splitting it on the first comma at render time would
-- work for both rows today and quietly produce nonsense the first time someone
-- writes a label without one.
--
-- So the greeting gets its own column, backfilled from the label but editable
-- on its own afterwards.

alter table public.staff_pins add column if not exists display_name text;

comment on column public.staff_pins.display_name is
  'First name to greet this PIN holder by. Backfilled from label; edit freely, '
  'the label stays the audit description.';

-- Everything before the first comma, trimmed. "Mark, owner" -> "Mark".
update public.staff_pins
   set display_name = nullif(btrim(split_part(label, ',', 1)), '')
 where display_name is null;

-- ── the lookup ──────────────────────────────────────────────────────────────
--
-- redeem_staff_pin returns a boolean and should keep returning a boolean: it is
-- the gate, and a gate answers yes or no. This is a separate read for a
-- separate purpose, and it returns a first name and nothing else.
--
-- Null for an unknown or disabled PIN, exactly as if the row were not there.
-- The greeting then renders without a name rather than announcing that the PIN
-- was rejected, because the page behind it has already decided that question.

create or replace function public.staff_pin_display_name(p_pin text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select display_name
    from public.staff_pins
   where pin = p_pin
     and enabled = true;
$$;

comment on function public.staff_pin_display_name(text) is
  'The greeting name for a valid staff PIN. Null for unknown or disabled. '
  'Returns no other column: a PIN buys a first name, not a directory.';

grant execute on function public.staff_pin_display_name(text) to anon, authenticated;
