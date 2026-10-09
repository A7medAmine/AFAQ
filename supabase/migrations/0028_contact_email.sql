-- The club's contact address moved to its university mailbox.
UPDATE "social_links" SET "url" = 'mailto:afaq.club@univ-bouira.dz', "updated_at" = now()
	WHERE "url" = 'mailto:afaqclub.bouira@gmail.com';
