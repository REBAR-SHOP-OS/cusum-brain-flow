CREATE OR REPLACE FUNCTION public.auto_add_to_general_channel()
RETURNS trigger AS $$
BEGIN
  INSERT INTO team_channel_members (channel_id, profile_id)
  SELECT tc.id, NEW.id
  FROM team_channels tc
  WHERE tc.name = 'General' AND tc.channel_type = 'group'
    AND tc.company_id = NEW.company_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_add_general
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_general_channel();