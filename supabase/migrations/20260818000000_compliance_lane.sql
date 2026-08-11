-- 20260818000000_compliance_lane.sql
--
-- What every current tenant is supposed to have on file, and what they
-- actually have. Nothing has ever asked. The first run says 20 of 20 have a
-- gap: 19 have no IRAS stamping recorded and 7 have no signed agreement in
-- either tenant_documents or onboarding_progress.
--
-- The required set is a table rather than a WHERE clause because it is
-- policy, not schema. Stamping applies to a licence tenant and not to a
-- short-stay guest, and that judgement should be editable by the person who
-- owns the judgement without a migration and a deploy.
--
-- Additive and idempotent. One config table, one view, no data touched.

create table if not exists public.compliance_requirements (
  id            uuid primary key default gen_random_uuid(),
  doc_kind      text not null,
  applies_to    text not null default 'TENANT',
  accepts       text[] not null,
  is_required   boolean not null default true,
  why           text,
  created_at    timestamptz not null default now(),
  unique (doc_kind, applies_to)
);

comment on table public.compliance_requirements is
  'What each kind of occupant must have on file. Policy, editable without a deploy.';

insert into public.compliance_requirements (doc_kind, applies_to, accepts, is_required, why)
values
  ('AGREEMENT', 'TENANT', array['LICENCE_AGREEMENT'], true,
   'The tenancy itself. Without it there is no written basis for the rent, the deposit or the notice period.'),
  ('ID',        'TENANT', array['PASSPORT','IMMIGRATION_PASS','NRIC'], true,
   'Proof of who is living in the room and that they may be in Singapore.'),
  ('STAMPING',  'TENANT', array['STAMPING'], true,
   'IRAS stamp duty is a legal obligation on the tenancy, and an unstamped agreement is not admissible in a dispute.')
on conflict (doc_kind, applies_to) do nothing;

create or replace view public.v_tenant_compliance as
with current_tenants as (
  select tp.id, tp.role, tp.room_id, tp.moved_in_at,
         coalesce(td.full_name, tp.username) as tenant_name
    from public.tenant_profiles tp
    left join public.tenant_details td on td.tenant_profile_id = tp.id
   where tp.is_active
     and tp.archived_at is null
     and tp.moved_out_at is null
     and tp.role = 'TENANT'
),
held as (
  select ct.id as tenant_profile_id, req.doc_kind, req.why, req.is_required,
         -- An agreement counts if it is signed anywhere we record signing.
         -- The portal writes one place and the document store another, and
         -- a tenant is no less covered because the paperwork landed in the
         -- other one.
         (exists (
            select 1 from public.tenant_documents d
             where d.tenant_profile_id = ct.id
               and d.doc_type = any (req.accepts)
               and (req.doc_kind <> 'AGREEMENT' or d.status ilike 'signed')
          )
          or (req.doc_kind = 'AGREEMENT' and exists (
            select 1 from public.onboarding_progress o
             where o.tenant_profile_id = ct.id
               and o.ta_signed_at is not null
          ))) as satisfied
    from current_tenants ct
    join public.compliance_requirements req
      on req.applies_to = ct.role and req.is_required
)
select
  ct.id                                            as tenant_profile_id,
  r.unit_code                                      as listing_code,
  ct.tenant_name,
  ct.moved_in_at,
  array_remove(array_agg(h.doc_kind order by h.doc_kind)
               filter (where not h.satisfied), null) as missing,
  count(*) filter (where not h.satisfied)          as missing_count,
  count(*)                                         as required_count,
  case
    -- Somebody living in the room with no written agreement at all is the
    -- one that is not a filing problem.
    when bool_or(h.doc_kind = 'AGREEMENT' and not h.satisfied) then 'CRITICAL'
    when count(*) filter (where not h.satisfied) > 1            then 'HIGH'
    when count(*) filter (where not h.satisfied) = 1            then 'NORMAL'
    else 'OK'
  end                                              as urgency
from current_tenants ct
join held h on h.tenant_profile_id = ct.id
left join public.rooms r on r.id = ct.room_id
group by ct.id, r.unit_code, ct.tenant_name, ct.moved_in_at;

comment on view public.v_tenant_compliance is
  'Every current tenant against the required document set. CRITICAL means no signed agreement exists anywhere.';
