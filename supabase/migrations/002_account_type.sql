-- ============================================================================
-- ATLASBANX - Account Type (Enterprise vs Cabinet)
-- Distinguishes self-auditing companies from accounting firms
-- ============================================================================

-- Enum account_type
CREATE TYPE public.account_type AS ENUM ('enterprise', 'cabinet');

-- Add column on profiles (default enterprise for new signups)
ALTER TABLE public.profiles
  ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'enterprise';

-- Backfill: existing accounts are cabinets (preserves current behavior)
UPDATE public.profiles SET account_type = 'cabinet';

-- Update handle_new_user trigger to read account_type from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (reads account_type from signup metadata, defaults to enterprise)
  INSERT INTO public.profiles (id, email, full_name, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'enterprise')::public.account_type
  );

  -- Create empty settings
  INSERT INTO public.user_settings (user_id, settings)
  VALUES (NEW.id, '{}');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
