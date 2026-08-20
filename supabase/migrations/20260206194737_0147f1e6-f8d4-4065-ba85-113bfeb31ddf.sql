-- Create comprehensive rebar standards table
CREATE TABLE public.rebar_standards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Rebar bar data
  bar_size VARCHAR(10) NOT NULL,  -- e.g., '10M', '15M', '20M', '#3', '#4', 'Ø10', 'Ø12'
  bar_size_mm DECIMAL(6,2),  -- Actual diameter in mm
  weight_per_meter DECIMAL(8,4) NOT NULL,  -- kg/m
  area_mm2 DECIMAL(10,2),  -- Cross-sectional area in mm²
  
  -- Standards and codes
  standard_code VARCHAR(20) NOT NULL DEFAULT 'ACI',  -- ACI, CSA, BS, DIN, IRAN
  grade VARCHAR(20),  -- e.g., '60', '400W', 'AIII', 'S400'
  
  -- Lap and development lengths (as multiplier of diameter)
  lap_tension_mult DECIMAL(5,2) DEFAULT 40,  -- e.g., 40d for lap in tension
  lap_compression_mult DECIMAL(5,2) DEFAULT 30,  -- e.g., 30d for lap in compression
  development_length_mult DECIMAL(5,2) DEFAULT 40,
  
  -- Hook dimensions (as multiplier of diameter)
  hook_90_extension_mult DECIMAL(5,2) DEFAULT 12,  -- 12d extension after 90° bend
  hook_180_extension_mult DECIMAL(5,2) DEFAULT 4,   -- 4d extension after 180° bend
  bend_radius_mult DECIMAL(5,2) DEFAULT 4,  -- Minimum bend radius
  
  -- Additional deductions for bends (mm)
  hook_90_deduction DECIMAL(8,2),  -- Length deduction for 90° hook
  hook_180_deduction DECIMAL(8,2),  -- Length deduction for 180° hook
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(bar_size, standard_code)
);

-- Create WWM standards table
CREATE TABLE public.wwm_standards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  designation VARCHAR(50) NOT NULL,  -- e.g., '152x152 MW9.1xMW9.1'
  wire_diameter_mm DECIMAL(5,2) NOT NULL,
  spacing_mm INTEGER NOT NULL,
  weight_per_m2 DECIMAL(8,4) NOT NULL,  -- kg/m²
  
  -- Sheet dimensions
  sheet_width_mm INTEGER DEFAULT 1220,  -- 4ft = 1220mm
  sheet_length_mm INTEGER DEFAULT 2440,  -- 8ft = 2440mm
  
  -- Overlap requirements
  overlap_mm INTEGER DEFAULT 300,  -- Standard overlap
  
  standard_code VARCHAR(20) NOT NULL DEFAULT 'CSA',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(designation, standard_code)
);

-- Create validation rules table
CREATE TABLE public.estimation_validation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,  -- 'spacing', 'dimension', 'quantity', 'weight', 'ratio'
  
  element_type VARCHAR(50),  -- 'foundation', 'column', 'beam', 'slab', 'wall', 'pier'
  
  -- Validation parameters
  min_value DECIMAL(12,4),
  max_value DECIMAL(12,4),
  unit VARCHAR(20),  -- 'mm', 'kg', 'tons', 'pieces'
  
  -- Error message
  error_message TEXT NOT NULL,
  warning_message TEXT,
  
  -- Priority
  severity VARCHAR(20) DEFAULT 'error',  -- 'error', 'warning', 'info'
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rebar_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wwm_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimation_validation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all authenticated users to read standards (reference data)
CREATE POLICY "Allow read rebar standards" ON public.rebar_standards FOR SELECT USING (true);
CREATE POLICY "Allow read wwm standards" ON public.wwm_standards FOR SELECT USING (true);
CREATE POLICY "Allow read validation rules" ON public.estimation_validation_rules FOR SELECT USING (true);

-- Only admins can modify standards
CREATE POLICY "Admins can manage rebar standards" ON public.rebar_standards 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
  
CREATE POLICY "Admins can manage wwm standards" ON public.wwm_standards 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
  
CREATE POLICY "Admins can manage validation rules" ON public.estimation_validation_rules 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insert standard rebar data (CSA/Canadian)
INSERT INTO public.rebar_standards (bar_size, bar_size_mm, weight_per_meter, area_mm2, standard_code, grade, lap_tension_mult, lap_compression_mult) VALUES
('10M', 11.3, 0.785, 100, 'CSA', '400W', 40, 30),
('15M', 16.0, 1.570, 200, 'CSA', '400W', 40, 30),
('20M', 19.5, 2.355, 300, 'CSA', '400W', 40, 30),
('25M', 25.2, 3.925, 500, 'CSA', '400W', 45, 35),
('30M', 29.9, 5.495, 700, 'CSA', '400W', 45, 35),
('35M', 35.7, 7.850, 1000, 'CSA', '400W', 50, 40);

-- Insert Iranian rebar data (ISIRI)
INSERT INTO public.rebar_standards (bar_size, bar_size_mm, weight_per_meter, area_mm2, standard_code, grade, lap_tension_mult, lap_compression_mult) VALUES
('Ø8', 8.0, 0.395, 50, 'IRAN', 'AIII', 45, 35),
('Ø10', 10.0, 0.617, 78.5, 'IRAN', 'AIII', 45, 35),
('Ø12', 12.0, 0.888, 113, 'IRAN', 'AIII', 45, 35),
('Ø14', 14.0, 1.210, 154, 'IRAN', 'AIII', 45, 35),
('Ø16', 16.0, 1.580, 201, 'IRAN', 'AIII', 45, 35),
('Ø18', 18.0, 2.000, 254, 'IRAN', 'AIII', 50, 40),
('Ø20', 20.0, 2.470, 314, 'IRAN', 'AIII', 50, 40),
('Ø22', 22.0, 2.980, 380, 'IRAN', 'AIII', 50, 40),
('Ø25', 25.0, 3.850, 491, 'IRAN', 'AIII', 55, 45),
('Ø28', 28.0, 4.830, 616, 'IRAN', 'AIII', 55, 45),
('Ø32', 32.0, 6.310, 804, 'IRAN', 'AIII', 60, 50);

-- Insert ACI/US rebar data
INSERT INTO public.rebar_standards (bar_size, bar_size_mm, weight_per_meter, area_mm2, standard_code, grade, lap_tension_mult, lap_compression_mult) VALUES
('#3', 9.5, 0.560, 71, 'ACI', '60', 40, 30),
('#4', 12.7, 0.994, 129, 'ACI', '60', 40, 30),
('#5', 15.9, 1.552, 199, 'ACI', '60', 40, 30),
('#6', 19.1, 2.235, 284, 'ACI', '60', 45, 35),
('#7', 22.2, 3.042, 387, 'ACI', '60', 45, 35),
('#8', 25.4, 3.973, 510, 'ACI', '60', 45, 35),
('#9', 28.7, 5.059, 645, 'ACI', '60', 50, 40),
('#10', 32.3, 6.404, 819, 'ACI', '60', 50, 40),
('#11', 35.8, 7.907, 1006, 'ACI', '60', 55, 45);

-- Insert WWM standards
INSERT INTO public.wwm_standards (designation, wire_diameter_mm, spacing_mm, weight_per_m2, standard_code) VALUES
('152x152 MW9.1xMW9.1', 3.4, 152, 1.17, 'CSA'),
('152x152 MW18.7xMW18.7', 4.9, 152, 2.42, 'CSA'),
('152x152 MW25.8xMW25.8', 5.7, 152, 3.33, 'CSA'),
('102x102 MW9.1xMW9.1', 3.4, 102, 1.75, 'CSA'),
('102x102 MW18.7xMW18.7', 4.9, 102, 3.63, 'CSA'),
('100x100 Ø6', 6.0, 100, 4.44, 'IRAN'),
('150x150 Ø6', 6.0, 150, 2.96, 'IRAN'),
('150x150 Ø8', 8.0, 150, 5.27, 'IRAN'),
('200x200 Ø8', 8.0, 200, 3.95, 'IRAN');

-- Insert validation rules
INSERT INTO public.estimation_validation_rules (rule_name, rule_type, element_type, min_value, max_value, unit, error_message, warning_message, severity) VALUES
('Min rebar spacing', 'spacing', NULL, 50, NULL, 'mm', 'Spacing below 50mm is not practical', 'Spacing below 75mm may cause placement issues', 'error'),
('Max rebar spacing slab', 'spacing', 'slab', NULL, 300, 'mm', 'Slab rebar spacing exceeds 300mm maximum', NULL, 'error'),
('Max rebar spacing beam', 'spacing', 'beam', NULL, 200, 'mm', 'Beam stirrup spacing exceeds 200mm maximum', 'Consider reducing stirrup spacing', 'warning'),
('Min cover', 'dimension', NULL, 25, NULL, 'mm', 'Concrete cover below minimum 25mm', 'Check cover requirements for exposure class', 'error'),
('Reasonable bar diameter', 'dimension', NULL, 6, 50, 'mm', 'Bar diameter outside reasonable range 6-50mm', NULL, 'error'),
('Slab thickness range', 'dimension', 'slab', 100, 500, 'mm', 'Slab thickness outside typical range 100-500mm', 'Verify slab thickness', 'warning'),
('Foundation depth', 'dimension', 'foundation', 200, 3000, 'mm', 'Foundation depth outside typical range', NULL, 'warning'),
('Weight per m³ ratio', 'ratio', NULL, 50, 250, 'kg/m³', 'Rebar weight ratio outside typical 50-250 kg/m³', 'Check calculations - unusual kg/m³ ratio', 'warning');

-- Add trigger for updated_at
CREATE TRIGGER update_rebar_standards_updated_at
  BEFORE UPDATE ON public.rebar_standards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_wwm_standards_updated_at
  BEFORE UPDATE ON public.wwm_standards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();