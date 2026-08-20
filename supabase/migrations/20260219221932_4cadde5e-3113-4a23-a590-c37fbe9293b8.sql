
-- ============================================================
-- Phase 4: Auto-scoring functions + triggers
-- ============================================================

-- 1. Function: Recalculate client_performance_memory for a customer
CREATE OR REPLACE FUNCTION public.recalculate_client_performance(p_customer_id uuid, p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_won integer;
  v_lost integer;
  v_revenue numeric;
  v_avg_margin numeric;
  v_avg_sat numeric;
  v_avg_delay numeric;
  v_reorder_rate numeric;
  v_win_rate numeric;
  v_lifetime_score numeric;
BEGIN
  -- Won/lost counts from leads
  SELECT
    count(*) FILTER (WHERE stage = 'won'),
    count(*) FILTER (WHERE stage IN ('lost','loss'))
  INTO v_won, v_lost
  FROM leads
  WHERE customer_id = p_customer_id AND company_id = p_company_id;

  -- Outcome-based metrics
  SELECT
    coalesce(sum(final_revenue), 0),
    coalesce(avg(actual_margin_pct), 0),
    coalesce(avg(client_satisfaction), 0),
    coalesce(avg(CASE WHEN delay_occurred THEN 1.0 ELSE 0.0 END), 0),
    coalesce(
      avg(CASE
        WHEN reorder_probability = 'High' THEN 100
        WHEN reorder_probability = 'Medium' THEN 50
        ELSE 10
      END), 0
    )
  INTO v_revenue, v_avg_margin, v_avg_sat, v_avg_delay, v_reorder_rate
  FROM lead_outcome_memory
  WHERE customer_id = p_customer_id AND company_id = p_company_id;

  -- Win rate
  v_win_rate := CASE WHEN (v_won + v_lost) > 0
    THEN round(v_won::numeric / (v_won + v_lost) * 100, 1)
    ELSE 0
  END;

  -- Composite lifetime score (0-100): weighted blend
  v_lifetime_score := round(
    (v_win_rate * 0.25) +
    (least(v_avg_margin, 50) * 0.20) +
    (v_avg_sat * 20 * 0.25) +       -- sat is 1-5, normalize to 0-100
    ((1 - v_avg_delay) * 100 * 0.15) +
    (v_reorder_rate * 0.15)
  , 1);

  -- Upsert
  INSERT INTO client_performance_memory (
    customer_id, company_id,
    total_won_leads, total_lost_leads, total_revenue,
    avg_margin_pct, avg_satisfaction, avg_delay_rate,
    win_rate_pct, reorder_rate_pct, client_lifetime_score,
    last_recalculated_at
  ) VALUES (
    p_customer_id, p_company_id,
    v_won, v_lost, v_revenue,
    v_avg_margin, v_avg_sat, v_avg_delay,
    v_win_rate, v_reorder_rate, v_lifetime_score,
    now()
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    total_won_leads = EXCLUDED.total_won_leads,
    total_lost_leads = EXCLUDED.total_lost_leads,
    total_revenue = EXCLUDED.total_revenue,
    avg_margin_pct = EXCLUDED.avg_margin_pct,
    avg_satisfaction = EXCLUDED.avg_satisfaction,
    avg_delay_rate = EXCLUDED.avg_delay_rate,
    win_rate_pct = EXCLUDED.win_rate_pct,
    reorder_rate_pct = EXCLUDED.reorder_rate_pct,
    client_lifetime_score = EXCLUDED.client_lifetime_score,
    last_recalculated_at = now(),
    updated_at = now();
END;
$$;

-- 2. Function: Score a single lead based on memory signals
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
  v_win_prob numeric := 20;  -- base probability
  v_priority numeric := 0;
  v_confidence text := 'low';
  v_signals integer := 0;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Signal 1: Qualification memory
  SELECT * INTO v_qual FROM lead_qualification_memory WHERE lead_id = p_lead_id LIMIT 1;
  IF FOUND THEN
    v_signals := v_signals + 1;
    -- Budget known + decision maker = higher probability
    IF v_qual.budget_known THEN v_win_prob := v_win_prob + 10; END IF;
    IF v_qual.decision_maker_identified THEN v_win_prob := v_win_prob + 8; END IF;
    IF v_qual.repeat_customer THEN v_win_prob := v_win_prob + 12; END IF;
    IF v_qual.competitors_involved THEN v_win_prob := v_win_prob - 5; END IF;
    -- Tonnage drives priority
    v_priority := v_priority + least(v_qual.estimated_tonnage / 10, 30);
  END IF;

  -- Signal 2: Pricing memory
  SELECT * INTO v_quote FROM lead_quote_memory WHERE lead_id = p_lead_id AND is_current = true LIMIT 1;
  IF FOUND THEN
    v_signals := v_signals + 1;
    -- Higher margin targets suggest confidence
    IF v_quote.target_margin_pct >= 15 THEN v_win_prob := v_win_prob + 5; END IF;
    -- Strategic priority boost
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
      -- High-performing clients boost win probability
      v_win_prob := v_win_prob + (v_client.win_rate_pct * 0.15);
      v_priority := v_priority + (v_client.client_lifetime_score * 0.1);
    END IF;
  END IF;

  -- Clamp values
  v_win_prob := least(greatest(v_win_prob, 5), 95);
  v_priority := least(greatest(v_priority, 0), 100);

  -- Confidence based on signal count
  IF v_signals >= 3 THEN v_confidence := 'high';
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

-- 3. Trigger: Auto-score lead after qualification memory insert
CREATE OR REPLACE FUNCTION public.trigger_score_after_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM score_lead(NEW.lead_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_score_after_qualification
AFTER INSERT ON public.lead_qualification_memory
FOR EACH ROW EXECUTE FUNCTION public.trigger_score_after_qualification();

-- 4. Trigger: Auto-score lead after quote memory insert
CREATE OR REPLACE FUNCTION public.trigger_score_after_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM score_lead(NEW.lead_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_score_after_quote
AFTER INSERT ON public.lead_quote_memory
FOR EACH ROW EXECUTE FUNCTION public.trigger_score_after_quote();

-- 5. Trigger: Auto-recalculate client performance + re-score lead after outcome
CREATE OR REPLACE FUNCTION public.trigger_after_outcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate client performance if customer linked
  IF NEW.customer_id IS NOT NULL THEN
    PERFORM recalculate_client_performance(NEW.customer_id, NEW.company_id);
  END IF;
  -- Re-score the lead
  PERFORM score_lead(NEW.lead_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_outcome
AFTER INSERT ON public.lead_outcome_memory
FOR EACH ROW EXECUTE FUNCTION public.trigger_after_outcome();

-- 6. Trigger: Auto-recalculate client stats after loss memory
CREATE OR REPLACE FUNCTION public.trigger_after_loss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Get customer_id from the lead
  SELECT customer_id INTO v_customer_id FROM leads WHERE id = NEW.lead_id;
  IF v_customer_id IS NOT NULL THEN
    PERFORM recalculate_client_performance(v_customer_id, NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_loss
AFTER INSERT ON public.lead_loss_memory
FOR EACH ROW EXECUTE FUNCTION public.trigger_after_loss();
