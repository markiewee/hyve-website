-- Fire TA_READY from the database, not from whoever happens to be uploading.
--
-- The "your agreement is ready to sign" email was a client-side call at the end
-- of AdminDocumentsPage.handleSendToMember. Any other route to the same state
-- (the onboarding detail page's own uploader, a script, an admin fixing a row
-- by hand) set ta_document_url and sent nothing, so the tenant sat waiting on a
-- document they were never told about. That is what happened to Julia Rönkkö on
-- 18 Aug 2026.
--
-- The state that matters is "onboarding_progress.ta_document_url now points at a
-- document the tenant has not signed". Trigger on that and every route is
-- covered, including ones not written yet.

create or replace function public.notify_ta_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- nothing to sign
  if new.ta_document_url is null or btrim(new.ta_document_url) = '' then
    return new;
  end if;

  -- unchanged document: an unrelated update to the row, not a new agreement
  if tg_op = 'UPDATE'
     and coalesce(old.ta_document_url, '') = coalesce(new.ta_document_url, '') then
    return new;
  end if;

  -- already signed: do not ask again
  if new.ta_signed_at is not null then
    return new;
  end if;

  -- Fire and forget. pg_net queues the request, so a slow or failing edge
  -- function can never block or roll back the upload that triggered it.
  perform net.http_post(
    url     := 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/notify-tenant',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpaWlscXBmbWx4andpYWVvcGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTU5NjMsImV4cCI6MjA4OTYzMTk2M30.ZISqWOMKlrOY7TIgBcJtI1nD1AJ1f350zZex099sRf8'),
    body    := jsonb_build_object(
                 'event_type', 'TA_READY',
                 'tenant_profile_id', new.tenant_profile_id,
                 'details', jsonb_build_object('source', 'db_trigger'))
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_ta_ready on public.onboarding_progress;

create trigger trg_notify_ta_ready
after insert or update of ta_document_url on public.onboarding_progress
for each row execute function public.notify_ta_ready();
