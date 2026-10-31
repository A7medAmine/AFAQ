-- HR may correct a registered name; a preferred name that no longer fits is
-- dropped instead of blocking the edit (the CHECK did block it).
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_preferred_name_check";--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.members_keep_preferred_name()
RETURNS TRIGGER AS $$
BEGIN
	IF NEW.preferred_name IS NOT NULL AND NOT name_uses_own_words(NEW.preferred_name, NEW.full_name) THEN
		NEW.preferred_name := NULL;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;--> statement-breakpoint
DROP TRIGGER IF EXISTS "members_keep_preferred_name" ON "members";--> statement-breakpoint
CREATE TRIGGER "members_keep_preferred_name" BEFORE INSERT OR UPDATE OF full_name, preferred_name ON "members"
	FOR EACH ROW EXECUTE FUNCTION public.members_keep_preferred_name();
