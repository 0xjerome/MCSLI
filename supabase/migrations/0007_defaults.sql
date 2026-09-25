-- MCSLI Learning Platform – 0007: baseline configuration rows (NOT demo data)
-- Payment methods are created DISABLED with empty details: MCSLI administrators
-- fill in the real bank account / MTN / Airtel merchant details in Admin → Settings.

insert into public.payment_methods (method_type, display_name, currency, is_enabled, position, instructions)
values
  ('bank',   'MCSLI Bank Account', 'UGX', false, 1, 'Transfer to the MCSLI bank account and enter the bank reference number below.'),
  ('mtn',    'MTN Mobile Money (MoMo Pay)', 'UGX', false, 2, 'Pay to the MCSLI MTN merchant code and enter the transaction ID from your confirmation SMS.'),
  ('airtel', 'Airtel Money (Airtel Pay)', 'UGX', false, 3, 'Pay to the MCSLI Airtel merchant code and enter the transaction ID from your confirmation SMS.')
on conflict do nothing;

insert into public.platform_settings (key, value) values
  ('registration_open', 'true'::jsonb),
  ('support_email', '"info@mcsli.org"'::jsonb),
  ('support_phone', '"0701806993"'::jsonb),
  ('support_whatsapp', '"+256701806993"'::jsonb),
  ('certificate', '{"signatory_name": "", "signatory_title": "Founder & Executive Director", "issuer": "Master Class Sign Language Initiative (MCSLI)", "footer_note": "Verify this certificate at mcsli.org/certificate/<number>"}'::jsonb),
  ('identity_retention_days', '365'::jsonb)
on conflict (key) do nothing;
