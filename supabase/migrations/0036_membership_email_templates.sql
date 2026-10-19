-- Membership emails (application received, membership approved) become
-- editable templates. The server falls back to its built-in text when no
-- template of the kind exists.
ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "email_templates_kind_check";--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("kind" IN ('announcement', 'event', 'general', 'application_received', 'membership_approved'));--> statement-breakpoint
INSERT INTO "email_templates" ("name", "kind", "subject", "header_text", "heading", "body", "button_label", "button_url", "footer", "accent_color", "is_default") VALUES
	('Application received', 'application_received', 'Membership Application Received — {{club_name}}', '{{club_name}}', 'Thank You, {{member_name}}!',
	 E'We have received your membership application. Our team will review it and get back to you soon.',
	 NULL, NULL,
	 E'Best regards,\n{{club_name}} Team', '#0F172A', true),
	('Membership approved', 'membership_approved', 'Membership Approved — Welcome to AFAQ!', '{{club_name}}', 'Welcome to AFAQ, {{member_name}}!',
	 E'Your membership application has been **approved**! We are thrilled to have you on board.\n\nStay tuned for upcoming events, workshops, and projects. You are now part of a community where technology meets innovation.\n\nJoin our Instagram community to connect with other members and catch every announcement.',
	 'Join our Instagram community', 'https://ig.me/j/7P2FzCrA3F5O5xrP/',
	 E'Best regards,\n{{club_name}} Team', '#0F172A', true);
