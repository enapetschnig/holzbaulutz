CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_whitelisted BOOLEAN;
BEGIN
  -- Bootstrap nur, solange es noch keinen Administrator gibt. Sonst könnte sich jeder mit
  -- einer dieser Adressen (hier nicht vergeben, ohne Mail-Bestätigung) selbst zum Admin registrieren.
  is_whitelisted := NEW.email IN ('napetschnig.chris@gmail.com', 'hallo@epowergmbh.at')
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'administrator');

  INSERT INTO public.profiles (id, vorname, nachname, email, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'vorname', ''),
    COALESCE(NEW.raw_user_meta_data->>'nachname', ''),
    NEW.email,
    is_whitelisted
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE public.profiles.email IS NULL;

  -- Nur Bootstrap-Admins bekommen sofort eine Rolle. Alle anderen erst
  -- nach Freischaltung durch den Administrator (activate_user).
  IF is_whitelisted THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'administrator')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$
