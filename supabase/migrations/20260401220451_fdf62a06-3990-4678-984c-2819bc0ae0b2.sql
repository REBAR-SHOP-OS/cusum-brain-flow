
-- 1. auto_add_to_general_channel (SECURITY DEFINER trigger)
CREATE OR REPLACE FUNCTION public.auto_add_to_general_channel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO team_channel_members (channel_id, profile_id)
  SELECT tc.id, NEW.id
  FROM team_channels tc
  WHERE tc.name = 'General' AND tc.channel_type = 'group'
    AND tc.company_id = NEW.company_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2. auto_link_comm_to_lead (SECURITY DEFINER trigger)
CREATE OR REPLACE FUNCTION public.auto_link_comm_to_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  lead RECORD;
  clean_from TEXT;
  clean_to TEXT;
BEGIN
  clean_from := regexp_replace(COALESCE(NEW.from_address, ''), '[^0-9+]', '', 'g');
  clean_to := regexp_replace(COALESCE(NEW.to_address, ''), '[^0-9+]', '', 'g');

  FOR lead IN
    SELECT id, company_id, title FROM public.sales_leads
    WHERE company_id = NEW.company_id
      AND (
        (clean_from <> '' AND regexp_replace(COALESCE(contact_phone, ''), '[^0-9+]', '', 'g') IN (clean_from, clean_to))
        OR (COALESCE(NEW.from_address, '') <> '' AND lower(COALESCE(contact_email, '')) IN (lower(NEW.from_address), lower(COALESCE(NEW.to_address, ''))))
        OR (COALESCE(NEW.to_address, '') <> '' AND lower(COALESCE(contact_email, '')) IN (lower(COALESCE(NEW.from_address, '')), lower(NEW.to_address)))
      )
  LOOP
    INSERT INTO public.sales_lead_activities
      (sales_lead_id, company_id, activity_type, subject, body, user_id, user_name)
    VALUES (
      lead.id,
      lead.company_id,
      CASE WHEN NEW.channel = 'phone' THEN 'call' ELSE 'email' END,
      COALESCE(NEW.subject, lead.title || ' – ' || NEW.channel),
      COALESCE(NEW.body_text, LEFT(NEW.body_html, 500)),
      COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'),
      COALESCE(NEW.from_address, 'System')
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.communications
    SET lead_id = lead.id
    WHERE id = NEW.id AND lead_id IS NULL;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. block_lead_delete_with_children (plain trigger)
CREATE OR REPLACE FUNCTION public.block_lead_delete_with_children()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN OLD;
END;
$function$;

-- 4. norm_text (pure IMMUTABLE sql function)
CREATE OR REPLACE FUNCTION public.norm_text(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$ SELECT regexp_replace(lower(trim(coalesce(input,''))), '\s+', ' ', 'g'); $function$;

-- 5. validate_clockin_time (plain trigger)
CREATE OR REPLACE FUNCTION public.validate_clockin_time()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF extract(hour from (now() at time zone 'America/New_York')) < 6 THEN
    RAISE EXCEPTION 'Clock-in is only available from 6:00 AM ET';
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. validate_extract_session_status (plain trigger)
CREATE OR REPLACE FUNCTION public.validate_extract_session_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.status NOT IN ('uploaded','extracting','extracted','mapping','mapped','validated','approved','rejected','error') THEN
    RAISE EXCEPTION 'Invalid extract_session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- 7. validate_machine_capability (plain trigger)
CREATE OR REPLACE FUNCTION public.validate_machine_capability()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  _num int;
BEGIN
  IF NEW.capabilities IS NOT NULL THEN
    SELECT count(*) INTO _num
    FROM jsonb_array_elements_text(NEW.capabilities) AS cap
    WHERE cap NOT IN ('cut','bend','weld','thread','coil','decoil');
    IF _num > 0 THEN
      RAISE EXCEPTION 'Invalid machine capability detected';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 8. validate_quotation_status_transition (plain trigger)
CREATE OR REPLACE FUNCTION public.validate_quotation_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  allowed_from text[];
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'draft' THEN
      allowed_from := ARRAY['pricing_failed', 'internal_revision_requested', 'customer_revision_requested', 'expired'];
    WHEN 'pricing_in_progress' THEN
      allowed_from := ARRAY['draft', 'pricing_failed'];
    WHEN 'pricing_failed' THEN
      allowed_from := ARRAY['pricing_in_progress', 'draft'];
    WHEN 'quote_ready' THEN
      allowed_from := ARRAY['pricing_in_progress', 'draft'];
    WHEN 'awaiting_internal_review' THEN
      allowed_from := ARRAY['quote_ready'];
    WHEN 'internal_revision_requested' THEN
      allowed_from := ARRAY['awaiting_internal_review'];
    WHEN 'internally_approved' THEN
      allowed_from := ARRAY['awaiting_internal_review'];
    WHEN 'sent_to_customer' THEN
      allowed_from := ARRAY['internally_approved'];
    WHEN 'customer_approved' THEN
      allowed_from := ARRAY['sent_to_customer'];
    WHEN 'customer_revision_requested' THEN
      allowed_from := ARRAY['sent_to_customer'];
    WHEN 'customer_rejected' THEN
      allowed_from := ARRAY['sent_to_customer'];
    WHEN 'expired' THEN
      allowed_from := ARRAY['draft', 'quote_ready', 'awaiting_internal_review', 'internally_approved', 'sent_to_customer'];
    WHEN 'cancelled' THEN
      allowed_from := ARRAY['draft', 'pricing_in_progress', 'pricing_failed', 'quote_ready', 'awaiting_internal_review', 'internal_revision_requested', 'internally_approved', 'sent_to_customer', 'customer_revision_requested', 'expired'];
    ELSE
      RAISE EXCEPTION 'Unknown quotation status: %', NEW.status;
  END CASE;

  IF OLD.status = ANY(allowed_from) THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Invalid quotation status transition: % → %', OLD.status, NEW.status;
  END IF;
END;
$function$;
