
-- Step 1: Create quote_pricing_configs table
CREATE TABLE public.quote_pricing_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  config_name TEXT NOT NULL DEFAULT 'Default 2026',
  is_active BOOLEAN NOT NULL DEFAULT true,
  pricing_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_pricing_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies: company-scoped
CREATE POLICY "Users can view their company pricing configs"
  ON public.quote_pricing_configs FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their company pricing configs"
  ON public.quote_pricing_configs FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company pricing configs"
  ON public.quote_pricing_configs FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company pricing configs"
  ON public.quote_pricing_configs FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_quote_pricing_configs_updated_at
  BEFORE UPDATE ON public.quote_pricing_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default pricing config for primary company
INSERT INTO public.quote_pricing_configs (company_id, config_name, is_active, pricing_data)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Default 2026',
  true,
  '{
    "straight_rebars": [
      {"bar_size": "10M", "length_ft": 20, "price_each_cad": 8.50},
      {"bar_size": "10M", "length_ft": 40, "price_each_cad": 17.00},
      {"bar_size": "15M", "length_ft": 20, "price_each_cad": 14.00},
      {"bar_size": "15M", "length_ft": 40, "price_each_cad": 28.00},
      {"bar_size": "20M", "length_ft": 20, "price_each_cad": 24.00},
      {"bar_size": "20M", "length_ft": 40, "price_each_cad": 48.00},
      {"bar_size": "25M", "length_ft": 20, "price_each_cad": 38.00},
      {"bar_size": "25M", "length_ft": 40, "price_each_cad": 76.00},
      {"bar_size": "30M", "length_ft": 20, "price_each_cad": 55.00},
      {"bar_size": "30M", "length_ft": 40, "price_each_cad": 110.00},
      {"bar_size": "35M", "length_ft": 20, "price_each_cad": 75.00},
      {"bar_size": "35M", "length_ft": 40, "price_each_cad": 150.00}
    ],
    "fabrication_pricing": {
      "price_table": [
        {"min_ton": 0, "max_ton": 5, "price_per_ton_cad": 2800},
        {"min_ton": 5, "max_ton": 10, "price_per_ton_cad": 2600},
        {"min_ton": 10, "max_ton": 25, "price_per_ton_cad": 2400},
        {"min_ton": 25, "max_ton": 50, "price_per_ton_cad": 2200},
        {"min_ton": 50, "max_ton": 100, "price_per_ton_cad": 2000},
        {"min_ton": 100, "max_ton": 99999, "price_per_ton_cad": 1850}
      ],
      "shop_drawing_per_ton_cad": 150
    },
    "dowels": [
      {"type": "10M", "size": "6\"x18\"", "price_each_cad": 3.50},
      {"type": "10M", "size": "8\"x24\"", "price_each_cad": 4.50},
      {"type": "15M", "size": "6\"x18\"", "price_each_cad": 5.00},
      {"type": "15M", "size": "8\"x24\"", "price_each_cad": 6.50},
      {"type": "20M", "size": "8\"x24\"", "price_each_cad": 9.00},
      {"type": "20M", "size": "10\"x30\"", "price_each_cad": 12.00}
    ],
    "ties_circular": [
      {"type": "10M", "diameter": "12\"", "price_each_cad": 4.00},
      {"type": "10M", "diameter": "18\"", "price_each_cad": 5.50},
      {"type": "10M", "diameter": "24\"", "price_each_cad": 7.00},
      {"type": "15M", "diameter": "12\"", "price_each_cad": 6.00},
      {"type": "15M", "diameter": "18\"", "price_each_cad": 8.00},
      {"type": "15M", "diameter": "24\"", "price_each_cad": 10.50}
    ],
    "cage_price_per_ton_cad": 5500,
    "coating_multipliers": {"black": 1, "epoxy": 2, "galvanized": 2},
    "shipping_per_km_cad": 3,
    "default_truck_capacity_tons": 7,
    "default_scrap_percent": 15
  }'::jsonb
);
