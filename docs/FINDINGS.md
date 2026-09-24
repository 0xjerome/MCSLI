# Findings: repository vs. live website (mcsli.org)

Inspected on 2026-09-25 before any changes were made.

## Repository state (commit `ec39948`)

- Vite 5 + React 18 + TypeScript + Tailwind 3, `react-router-dom` v7, `lucide-react`.
- Ten hand-written pages (`Home`, `About`, `FocusAreas`, `Programs`, `Team`, `Donate`, `Events`, `Gallery`, `Blog`, `Contact`) with all copy, statistics and contact details hard-coded inside JSX.
- No backend, no auth, no tests, no SEO metadata, README is the single word "MCSLI".
- Forms (`Contact`, `Team` volunteer form) only `console.log` and `alert()`.
- Gallery/Blog used external Pexels stock photos and invented blog posts (e.g. "Volunteer Spotlight: Meet Sarah Johnson from Canada") and invented blog statistics ("50+ Articles Published", "1,000+ Monthly Readers", "95% Positive Feedback").
- Five images in `public/`: `logo_.jpg`, `img_6715.jpeg`, `img_6717.jpeg`, `unnamed-2.jpg`, `unnamed-3.jpg` (all portraits – no activity photography).

## Live website state (client-rendered SPA, bundle `assets/index-DJGZV2iq.js`)

The deployed site is a **newer** version than the repository. Differences that matter:

| Topic | Repository | Live website | Decision |
|---|---|---|---|
| Home impact stats | 15+ districts, 500+ people trained, 8 programs, 2+ years | **5** districts, **150** people trained, **6** programs, **2** years | Conflict. Stats moved to admin-managed `site_content`; seeded with the live-site values and flagged for MCSLI to confirm. |
| Events page stats | 50+ events, 1,500+ participants, 15 districts, 12 partner orgs | Events page not present on live site | Removed – unverifiable. |
| Gallery stats | 100+ photos, 50+ events, 15 districts, 2+ years | 100+ photos, 50+ events, **5** districts, 2 years | Not shown as statistics (decorative and inconsistent). |
| Shop page stats | – | 500+ students trained, 20+ programs, 10+ partners (contradicts home page "150 people trained") | Not reproduced. |
| Contact e-mail | `mclass394@gmail.com` | `info@mcsli.org` | Live value used; admin-editable. |
| Social links | `#` placeholders | Facebook, X, Instagram, LinkedIn URLs | Live values used; admin-editable. |
| Team | Kakooza Peter = General Secretary; Iraguha Emmanuel = Partnership & Communications Officer; `img_6717` = Ssenyonjo; `img_6715` = Bukenya; `unnamed-3` = Kakooza | Kakooza Peter = Partnership & Communications Officer; Iraguha Emmanuel not listed; `img_6715` = Ssenyonjo; `unnamed-3` = Ochen Morris; dedicated photos for Bukenya, Mulindwa, Kakooza, Nakato | Live mapping used (newer). Team list is admin-editable content. |
| Impact stories | Generic "Educational Impact / Community Building / Personal Growth" cards | Six real learner testimonies with photos (Nakalanda Sandra, Mwesigwa David, Elizabeth Sebunya, Namukwaya Sharon Kigongo, Ssekamatte Yuda Morris, Nalwanga Lilian) | Live stories preserved verbatim as content. |
| Donation details | None | dfcu Bank account, SWIFT code, MTN MoMo merchant 407014, Airtel merchant 4392640 (published for **donations**) | Preserved on the public Donate page as published. **Not** copied into tuition payment settings – the brief states tuition merchant/bank details were not provided; admins configure them in Admin → Settings → Payment methods. |
| Programs | 5 training programs, schedule, "certificate issued by UNAD" | Identical | Preserved. Certificate wording is MCSLI's own claim on its website; it is kept as-is in editable content. |
| Focus areas | 9 areas on a dedicated page | 6 on the home page (adds "Global Partnerships") | Merged into Programs/About; editable. |
| Shop | Not present | 6 polo shirts, UGX 50,000–55,000 | Preserved as a simple catalogue (enquiry-based, no checkout). |
| Blog | 7 invented posts with stock photos | Not present | Replaced by *Resources* page with real stories + admin-managed announcements. No fabricated posts. |
| Events | Invented events with dates | Not present | Events page kept as admin-managed list (empty state until MCSLI adds events). |
| Mobile app | "Coming soon" with "500+ lessons, 50+ exercises, FREE" | Same block | Numbers removed (unverifiable); future features labelled clearly. |

## Legitimate organisation facts preserved

- Name: Master Class Sign Language Initiative (MCSLI); Deaf-led; founded 2023; registered with URSB 2024, registration number 80034987295030.
- Slogan: "Through Sign Language, the Hand Can Speak". Tagline: "Empowering the Deaf, Connecting Communities, Inspiring Change."
- Mission, vision, Founder's Vision 2040 (Ssenyonjo Jim Maurice, Founder & Executive Director), ten core values.
- Address: Plot 254, Sir Apollo Kaggwa Road, Makerere, Kampala, Uganda. Phone 0701806993 (WhatsApp & SMS). Working hours Mon–Fri 8:00–17:00, Sat 9:00–13:00.
- Training schedule: Online Mon & Tue 16:00–18:00; Physical Thu 15:40–17:30; Weekend Sat 09:30–12:30.

## Media

53 authentic images were retrieved from the live site (37 gallery photos with their captions/dates, 6 team portraits, 6 story portraits, 6 shop photos), re-encoded at ≤1200 px, and stored under `public/media/` with a `manifest.json`. Original filenames were replaced with descriptive slugs.
