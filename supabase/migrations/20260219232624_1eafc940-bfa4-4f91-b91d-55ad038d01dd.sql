
-- Enhanced score_lead: add stage age and communication recency signals
CREATE OR REPLACE FUNCTION public.score_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_qual record;
  v_quote record;
  v_client record;
  v_win_prob numeric := 20;
  v_priority numeric := 0;
  v_confidence text := 'low';
  v_signals integer := 0;
  v_stage_age integer;
  v_recent_comms integer;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Signal 1: Qualification memory
  SELECT * INTO v_qual FROM lead_qualification_memory WHERE lead_id = p_lead_id LIMIT 1;
  IF FOUND THEN
    v_signals := v_signals + 1;
    IF v_qual.budget_known THEN v_win_prob := v_win_prob + 10; END IF;
    IF v_qual.decision_maker_identified THEN v_win_prob := v_win_prob + 8; END IF;
    IF v_qual.repeat_customer THEN v_win_prob := v_win_prob + 12; END IF;
    IF v_qual.competitors_involved THEN v_win_prob := v_win_prob - 5; END IF;
    v_priority := v_priority + least(v_qual.estimated_tonnage / 10, 30);
  END IF;

  -- Signal 2: Pricing memory
  SELECT * INTO v_quote FROM lead_quote_memory WHERE lead_id = p_lead_id AND is_current = true LIMIT 1;
  IF FOUND THEN
    v_signals := v_signals + 1;
    IF v_quote.target_margin_pct >= 15 THEN v_win_prob := v_win_prob + 5; END IF;
    IF v_quote.strategic_priority = 'High' THEN
      v_priority := v_priority + 20;
      v_win_prob := v_win_prob + 5;
    ELSIF v_quote.strategic_priority = 'Medium' THEN
      v_priority := v_priority + 10;
    END IF;
  END IF;

  -- Signal 3: Client history
  IF v_lead.customer_id IS NOT NULL THEN
    SELECT * INTO v_client FROM client_performance_memory WHERE customer_id = v_lead.customer_id LIMIT 1;
    IF FOUND THEN
      v_signals := v_signals + 1;
      v_win_prob := v_win_prob + (v_client.win_rate_pct * 0.15);
      v_priority := v_priority + (v_client.client_lifetime_score * 0.1);
    END IF;
  END IF;

  -- Signal 4: Stage age (stale leads lose probability)
  v_stage_age := EXTRACT(DAY FROM (now() - v_lead.updated_at))::integer;
  IF v_stage_age > 30 THEN
    v_win_prob := v_win_prob - least(v_stage_age * 0.3, 20);
    v_signals := v_signals + 1;
  ELSIF v_stage_age <= 3 THEN
    v_win_prob := v_win_prob + 3; -- fresh leads get a small boost
    v_signals := v_signals + 1;
  END IF;

  -- Signal 5: Recent communications (last 14 days)
  SELECT COUNT(*) INTO v_recent_comms
  FROM communications
  WHERE lead_id = p_lead_id AND created_at > now() - interval '14 days';
  IF v_recent_comms >= 3 THEN
    v_win_prob := v_win_prob + 8;
    v_signals := v_signals + 1;
  ELSIF v_recent_comms >= 1 THEN
    v_win_prob := v_win_prob + 3;
    v_signals := v_signals + 1;
  ELSIF v_recent_comms = 0 AND v_stage_age > 7 THEN
    v_win_prob := v_win_prob - 5; -- no comms + aging = lower prob
  END IF;

  -- Clamp values
  v_win_prob := least(greatest(v_win_prob, 5), 95);
  v_priority := least(greatest(v_priority, 0), 100);

  -- Confidence based on signal count
  IF v_signals >= 4 THEN v_confidence := 'high';
  ELSIF v_signals >= 2 THEN v_confidence := 'medium';
  ELSE v_confidence := 'low';
  END IF;

  -- Update lead
  UPDATE leads SET
    win_prob_score = round(v_win_prob, 1),
    priority_score = round(v_priority, 1),
    score_confidence = v_confidence,
    probability = round(v_win_prob)::integer
  WHERE id = p_lead_id;
END;
$$;

-- Auto-score leads on stage change
CREATE OR REPLACE FUNCTION public.auto_score_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM score_lead(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trg_auto_score_on_stage_change ON public.leads;
CREATE TRIGGER trg_auto_score_on_stage_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_score_on_stage_change();
