-- =============================================================================
-- MCSLI DEVELOPMENT SEED – DEMO DATA ONLY. NEVER RUN ON PRODUCTION.
-- Everything here is labelled "[DEMO]" so it can be recognised and removed:
--   delete from public.courses where slug like 'demo-%';
--   delete from public.payment_methods where display_name like '[DEMO]%';
-- Demo user accounts are created separately with scripts/seed-demo-users.mjs
-- (they must go through Supabase Auth), or by the DB integration tests.
-- =============================================================================

-- Fixed UUIDs so tests and scripts can reference the demo course.
-- course           : 11111111-1111-1111-1111-111111111111
-- months 1..3      : 22222222-2222-2222-2222-22222222220N
-- modules          : 33333333-3333-3333-3333-3333333330NN
-- lessons          : 44444444-4444-4444-4444-4444444440NN
-- quizzes          : 55555555-5555-5555-5555-55555555550N
-- final exam       : 66666666-6666-6666-6666-666666666601

insert into public.courses (id, slug, title, short_description, description, duration_months, currency, tuition_national, tuition_international, registration_fee, installments_enabled, installment_count, installment_due_before_month, quiz_passing_score, requires_final_exam, certificate_title, is_published)
values (
  '11111111-1111-1111-1111-111111111111', 'demo-usl-foundations',
  '[DEMO] Ugandan Sign Language Foundations',
  'A three-month online introduction to Ugandan Sign Language (USL): the alphabet, numbers, everyday vocabulary, sentence structure and Deaf culture.',
  'This is development demo content. The real MCSLI curriculum, lesson videos and quiz questions must be entered by MCSLI trainers through the admin tools.',
  3, 'UGX', 350000, 400000, 20000, true, 2, '{"2": 2}'::jsonb, 70, true, 'Certificate of Completion – Ugandan Sign Language', true
) on conflict (id) do nothing;

insert into public.course_months (id, course_id, month_number, title, description, requires_assessment) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 1, 'Foundations', 'Fingerspelling, numbers, greetings and introductions, Deaf culture basics.', true),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 2, 'Everyday Communication', 'Family, time, places, food, feelings and simple conversations.', true),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 3, 'Sentences and Stories', 'Sentence building, questions, storytelling, signing songs and receptive practice.', true)
on conflict (id) do nothing;

insert into public.modules (id, month_id, position, title, description) values
  ('33333333-3333-3333-3333-333333333011', '22222222-2222-2222-2222-222222222201', 1, 'Welcome & the USL alphabet', 'Fingerspelling A–Z and your sign name.'),
  ('33333333-3333-3333-3333-333333333012', '22222222-2222-2222-2222-222222222201', 2, 'Numbers & greetings', 'Numbers 1–100, greetings, introductions.'),
  ('33333333-3333-3333-3333-333333333021', '22222222-2222-2222-2222-222222222202', 1, 'Family & people', 'Family signs, pronouns and describing people.'),
  ('33333333-3333-3333-3333-333333333022', '22222222-2222-2222-2222-222222222202', 2, 'Time, places & food', 'Days, months, places around town, food and drink.'),
  ('33333333-3333-3333-3333-333333333031', '22222222-2222-2222-2222-222222222203', 1, 'Sentence building', 'USL word order, questions and negation.'),
  ('33333333-3333-3333-3333-333333333032', '22222222-2222-2222-2222-222222222203', 2, 'Stories & songs', 'Storytelling, signing a song, receptive skills.')
on conflict (id) do nothing;

-- Demo lessons use the placeholder video shipped in public/demo (video_url) rather than private storage.
insert into public.lessons (id, module_id, position, title, description, objectives, video_url, captions_path, transcript, duration_seconds) values
  ('44444444-4444-4444-4444-444444444011', '33333333-3333-3333-3333-333333333011', 1, '[DEMO] Welcome to MCSLI online', 'How the course works, how assessments work and how to practise.', array['Understand the monthly structure','Know how to contact your trainer','Set up your practice space'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: Welcome to the MCSLI online Ugandan Sign Language course. Each month contains lessons, practice signs, quizzes and a trainer assessment.', 12),
  ('44444444-4444-4444-4444-444444444012', '33333333-3333-3333-3333-333333333011', 2, '[DEMO] The USL alphabet A–M', 'Fingerspelling the first half of the alphabet.', array['Fingerspell A–M','Recognise fingerspelled names'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: In this lesson we fingerspell the letters A to M.', 12),
  ('44444444-4444-4444-4444-444444444013', '33333333-3333-3333-3333-333333333011', 3, '[DEMO] The USL alphabet N–Z and sign names', 'Finishing the alphabet and introducing sign names.', array['Fingerspell N–Z','Explain what a sign name is'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: letters N to Z, and why the Deaf community gives sign names.', 12),
  ('44444444-4444-4444-4444-444444444014', '33333333-3333-3333-3333-333333333012', 1, '[DEMO] Numbers 1–100', 'Counting and number signs.', array['Sign numbers 1–100'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: numbers one to one hundred.', 12),
  ('44444444-4444-4444-4444-444444444015', '33333333-3333-3333-3333-333333333012', 2, '[DEMO] Greetings and introductions', 'Hello, how are you, my name is…', array['Greet someone in USL','Introduce yourself'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: greetings and introductions.', 12),
  ('44444444-4444-4444-4444-444444444021', '33333333-3333-3333-3333-333333333021', 1, '[DEMO] Family signs', 'Mother, father, sister, brother and more.', array['Sign 15 family words'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: family signs.', 12),
  ('44444444-4444-4444-4444-444444444022', '33333333-3333-3333-3333-333333333022', 1, '[DEMO] Days, months and time', 'Talking about when.', array['Sign the days and months','Ask what time it is'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: time signs.', 12),
  ('44444444-4444-4444-4444-444444444031', '33333333-3333-3333-3333-333333333031', 1, '[DEMO] USL sentence order', 'Topic–comment structure and questions.', array['Build a simple sentence','Ask a WH-question'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: sentence order.', 12),
  ('44444444-4444-4444-4444-444444444032', '33333333-3333-3333-3333-333333333032', 1, '[DEMO] Signing a song', 'Rhythm, expression and space.', array['Sign a short song'], '/demo/demo-lesson.mp4', '/demo/demo-lesson.vtt', 'Demo transcript: signing a song.', 12)
on conflict (id) do nothing;

insert into public.practice_items (month_id, position, title, description, movement_notes, video_url) values
  ('22222222-2222-2222-2222-222222222201', 1, '[DEMO] Fingerspell your name', 'Spell your first name slowly, then at conversational speed.', 'Keep the hand at shoulder height, palm facing out. Pause slightly between letters.', '/demo/demo-lesson.mp4'),
  ('22222222-2222-2222-2222-222222222201', 2, '[DEMO] Greeting: HELLO / HOW ARE YOU', 'Practise the greeting exchange with facial expression.', 'Raise eyebrows for the question; keep the movement small and clear.', '/demo/demo-lesson.mp4'),
  ('22222222-2222-2222-2222-222222222202', 1, '[DEMO] MOTHER / FATHER', 'Family signs practice.', 'Note the location on the face; contrast the two signs.', '/demo/demo-lesson.mp4'),
  ('22222222-2222-2222-2222-222222222203', 1, '[DEMO] Ask a WH-question', 'Practise WHERE, WHAT, WHO with the correct non-manual marker.', 'Furrow eyebrows for WH-questions; hold the sign at the end.', '/demo/demo-lesson.mp4');

insert into public.quizzes (id, month_id, module_id, title, description, passing_score, max_attempts) values
  ('55555555-5555-5555-5555-555555555501', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333011', '[DEMO] Month 1 quiz – alphabet & numbers', 'Sample questions for development only.', 70, null),
  ('55555555-5555-5555-5555-555555555502', '22222222-2222-2222-2222-222222222202', null, '[DEMO] Month 2 quiz – everyday signs', 'Sample questions for development only.', 70, 3),
  ('55555555-5555-5555-5555-555555555503', '22222222-2222-2222-2222-222222222203', null, '[DEMO] Month 3 quiz – sentences', 'Sample questions for development only.', 70, 3)
on conflict (id) do nothing;

insert into public.quiz_questions (quiz_id, position, question_type, prompt, video_url, options, correct_answer, explanation, points) values
  ('55555555-5555-5555-5555-555555555501', 1, 'multiple_choice', '[DEMO] Which hand shape is used for the USL letter "A" in this course?', null, '[{"id":"a","text":"Closed fist, thumb beside the fingers"},{"id":"b","text":"Open flat hand"},{"id":"c","text":"Index finger pointing up"},{"id":"d","text":"Two fingers crossed"}]', '"a"', 'Demo explanation – the trainer will replace this with real curriculum content.', 1),
  ('55555555-5555-5555-5555-555555555501', 2, 'video_multiple_choice', '[DEMO] Watch the video. Which number is being signed?', '/demo/demo-lesson.mp4', '[{"id":"a","text":"5"},{"id":"b","text":"10"},{"id":"c","text":"20"},{"id":"d","text":"100"}]', '"b"', 'Demo explanation.', 1),
  ('55555555-5555-5555-5555-555555555501', 3, 'matching', '[DEMO] Match each greeting to its meaning.', null, '{"left":[{"id":"l1","text":"HELLO"},{"id":"l2","text":"THANK YOU"},{"id":"l3","text":"GOODBYE"}],"right":[{"id":"r1","text":"Wave from the forehead outward"},{"id":"r2","text":"Flat hand from the chin forward"},{"id":"r3","text":"Open-close hand wave"}]}', '{"l1":"r1","l2":"r2","l3":"r3"}', 'Demo explanation.', 2),
  ('55555555-5555-5555-5555-555555555502', 1, 'multiple_choice', '[DEMO] Where is the sign MOTHER located?', null, '[{"id":"a","text":"Chin"},{"id":"b","text":"Forehead"},{"id":"c","text":"Chest"},{"id":"d","text":"Shoulder"}]', '"a"', 'Demo explanation.', 1),
  ('55555555-5555-5555-5555-555555555502', 2, 'multiple_choice', '[DEMO] Which non-manual marker accompanies a yes/no question?', null, '[{"id":"a","text":"Raised eyebrows"},{"id":"b","text":"Furrowed eyebrows"},{"id":"c","text":"Head shake"},{"id":"d","text":"Closed eyes"}]', '"a"', 'Demo explanation.', 1),
  ('55555555-5555-5555-5555-555555555503', 1, 'multiple_choice', '[DEMO] USL typically follows which structure?', null, '[{"id":"a","text":"Topic–comment"},{"id":"b","text":"Verb first"},{"id":"c","text":"Strictly English word order"},{"id":"d","text":"No structure"}]', '"a"', 'Demo explanation.', 1);

insert into public.exams (id, course_id, month_id, title, instructions, is_final, opens_at, closes_at, time_limit_minutes, max_attempts, randomize_questions, passing_score, status) values
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111', null, '[DEMO] Final examination', 'Answer all questions. The practical question will be graded by your trainer. You have 45 minutes once you start.', true, now() - interval '1 day', now() + interval '365 days', 45, 2, true, 60, 'open')
on conflict (id) do nothing;

insert into public.exam_questions (exam_id, position, question_type, prompt, options, correct_answer, points, requires_manual_grading) values
  ('66666666-6666-6666-6666-666666666601', 1, 'multiple_choice', '[DEMO] Which is the correct sign location for MOTHER?', '[{"id":"a","text":"Chin"},{"id":"b","text":"Forehead"},{"id":"c","text":"Chest"}]', '"a"', 2, false),
  ('66666666-6666-6666-6666-666666666601', 2, 'multiple_choice', '[DEMO] A WH-question uses which eyebrow position?', '[{"id":"a","text":"Raised"},{"id":"b","text":"Furrowed"},{"id":"c","text":"Neutral"}]', '"b"', 2, false),
  ('66666666-6666-6666-6666-666666666601', 3, 'practical', '[DEMO] Record yourself signing a short self-introduction (name, where you live, one hobby). Describe below how you signed it; your trainer will assess you live.', '[]', null, 6, true);

-- A demo cohort trainers can be assigned to.
insert into public.cohorts (id, course_id, name, start_date, is_open) values
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', '[DEMO] Online Cohort', current_date, true)
on conflict (id) do nothing;

-- [DEMO] payment method details so the payment form can be exercised. Replace in Admin → Settings.
update public.payment_methods set is_enabled = true, display_name = '[DEMO] ' || display_name,
  bank_name = case when method_type = 'bank' then 'Demo Bank (replace)' end,
  account_name = case when method_type = 'bank' then 'MCSLI (demo)' end,
  account_number = case when method_type = 'bank' then '0000000000' end,
  merchant_code = case when method_type in ('mtn', 'airtel') then '000000' end
where display_name not like '[DEMO]%';
