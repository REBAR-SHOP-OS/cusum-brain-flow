
-- Function: auto-link communications to sales leads
CREATE OR REPLACE FUNCTION public.auto_link_comm_to_lead()
RETURNS trigger AS $$
DECLARE
  lead RECORD;
  clean_from TEXT;
  clean_to TEXT;
BEGIN
  -- Normalize phone numbers (strip spaces, dashes, parens)
  clean_from := regexp_replace(COALESCE(NEW.from_address, ''), '[^0-9+]', '', 'g');
  clean_to := regexp_replace(COALESCE(NEW.to_address, ''), '[^0-9+]', '', 'g');

  -- Match by phone or email (100% exact match)
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
      lead.id, lead.company_id,
      CASE WHEN (NEW.metadata->>'type') = 'call' THEN 'call' ELSE 'email' END,
      COALESCE(NEW.subject, 'Communication'),
      NEW.body_preview,
      NEW.user_id,
      'Auto-linked'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on communications table
DROP TRIGGER IF EXISTS trg_auto_link_comm_to_lead ON public.communications;
CREATE TRIGGER trg_auto_link_comm_to_lead
  AFTER INSERT ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_comm_to_lead();
