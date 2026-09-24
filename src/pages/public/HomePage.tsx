import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus, CreditCard, PlayCircle, Hand, ClipboardCheck, Award, Video, Repeat, ListChecks, Users, TrendingUp, ShieldCheck, Quote, MessageCircleHeart, Briefcase, HeartHandshake, Megaphone } from 'lucide-react';
import { usePageMeta, organisationJsonLd } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Misc';
import { Section, ProgramCard, StoryCard, CtaBand } from '@/components/public/Sections';
import { Announcements } from '@/components/public/Announcements';

const steps = [
  { icon: UserPlus, title: 'Register', text: 'Create your account and tell us whether you study from Uganda or abroad.' },
  { icon: CreditCard, title: 'Enroll & pay', text: 'Choose full payment or two installments. Pay by bank, MTN or Airtel and submit the reference.' },
  { icon: PlayCircle, title: 'Learn', text: 'Watch captioned sign language lessons month by month, on any phone or computer.' },
  { icon: Hand, title: 'Practice', text: 'Replay signs slowly and practise beside the reference video with your own camera.' },
  { icon: ClipboardCheck, title: 'Assessment', text: 'Complete quizzes, then a live assessment with an MCSLI trainer to unlock the next month.' },
  { icon: Award, title: 'Certificate', text: 'Sit the final examination and receive a verifiable MCSLI certificate.' },
];

const experience = [
  { icon: Video, title: 'Video lessons', text: 'Clear, captioned lessons with transcripts and learning objectives.' },
  { icon: Repeat, title: 'Practice', text: 'Slow-motion replay and mirror mode for every practice sign.' },
  { icon: ListChecks, title: 'Quizzes', text: 'Instant feedback with explanations, and attempt history.' },
  { icon: Users, title: 'Trainer assessments', text: 'Real MCSLI trainers assess you each month and give feedback.' },
  { icon: TrendingUp, title: 'Progress tracking', text: 'See exactly what is complete, what is next and why something is locked.' },
  { icon: ShieldCheck, title: 'Certification', text: 'Unique certificate numbers with a public verification page and QR code.' },
];

export default function HomePage() {
  const { content } = useSiteContent();
  const { hero, organisation: org, programs, impact_stats, stories, contact } = content;
  usePageMeta({
    title: 'MCSLI – Learn Ugandan Sign Language | Master Class Sign Language Initiative',
    description: `${org.intro} Learn Ugandan Sign Language online or in Kampala.`,
    path: '/',
    jsonLd: organisationJsonLd({ address: contact.address, phone: contact.phoneIntl, email: contact.email, social: contact.social }),
  });

  const verifiedStats = impact_stats.stats.filter((s) => s.verified);
  const featured = stories.filter((s) => s.image).slice(0, 3);

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(60%_60%_at_50%_0%,theme(colors.brand.50),transparent)]" aria-hidden="true" />
        <div className="container-x relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-24">
          <div className="lg:col-span-6">
            <p className="eyebrow">{hero.eyebrow}</p>
            <h1 className="mt-4 text-display-lg sm:text-display-xl">
              {hero.headline}
              <br />
              <span className="text-brand-600">{hero.headlineAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">{hero.subheadline}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={hero.primaryCta.to} variant="accent" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
                {hero.primaryCta.label}
              </ButtonLink>
              <ButtonLink to={hero.secondaryCta.to} variant="outline" size="lg">
                {hero.secondaryCta.label}
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600" aria-label="About MCSLI">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" /> Deaf-led organisation
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" /> Ugandan Sign Language (USL)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" /> URSB registered · {org.registrationNumber}
              </li>
            </ul>
          </div>
          <div className="relative lg:col-span-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-100 shadow-raised">
              <img src={hero.image} alt={hero.imageAlt} className="h-full w-full object-cover" width={1200} height={900} fetchPriority="high" />
            </div>
            <figure className="absolute -bottom-6 left-4 right-4 flex items-center gap-3 rounded-xl border border-ink-200 bg-white/95 p-4 shadow-raised backdrop-blur sm:left-auto sm:right-6 sm:max-w-xs">
              <Quote className="h-6 w-6 shrink-0 text-accent-500" aria-hidden="true" />
              <blockquote className="font-display text-sm font-semibold leading-snug text-ink-900">“{org.slogan}”</blockquote>
            </figure>
          </div>
        </div>
      </section>

      <Announcements />

      {/* ---------------- Online learning ---------------- */}
      <Section tone="muted" id="online-learning">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              eyebrow="New · MCSLI Online"
              title="Learn Ugandan Sign Language online, month by month"
              description="The same MCSLI curriculum taught in Kampala, now on your phone. Each month combines video lessons, practice signs and quizzes, and finishes with a live assessment by an MCSLI trainer."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/register" variant="primary" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
                Start Learning Online
              </ButtonLink>
              <ButtonLink to="/online-learning" variant="ghost" size="lg">
                Course details & fees
              </ButtonLink>
            </div>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-7" aria-label="How it works">
            {steps.map((s, i) => (
              <li key={s.title} className="card relative p-5">
                <span className="absolute right-4 top-4 font-display text-xs font-bold text-ink-300">0{i + 1}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ---------------- Programs ---------------- */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeader eyebrow="What we do" title="Programs built for every learner" description={programs.intro} />
          <ButtonLink to="/programs" variant="outline">
            All programs
          </ButtonLink>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {programs.training.slice(0, 6).map((p) => (
            <ProgramCard key={p.slug} program={p} />
          ))}
        </div>
      </Section>

      {/* ---------------- Mission ---------------- */}
      <Section tone="dark" className="relative overflow-hidden">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow text-brand-300">Our purpose</p>
            <h2 className="mt-3 text-display-sm text-white sm:text-display-md">Our mission</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-200">{org.mission}</p>
            <h3 className="mt-8 font-display text-xl font-semibold text-white">Our vision</h3>
            <p className="mt-2 leading-relaxed text-ink-300">{org.vision}</p>
          </div>
          <figure className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-300">Vision 2040</p>
            <blockquote className="mt-4 font-display text-xl font-semibold leading-snug text-white">“{org.vision2040.quote}”</blockquote>
            <figcaption className="mt-5 text-sm text-ink-300">
              — {org.vision2040.author}, {org.vision2040.title}
            </figcaption>
          </figure>
        </div>
        <ul className="mt-12 flex flex-wrap gap-2" aria-label="Core values">
          {org.coreValues.map((v) => (
            <li key={v} className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-ink-200">
              {v}
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------------- Impact ---------------- */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              eyebrow="Impact"
              title="Real people, real conversations"
              description="Since 2023, MCSLI has trained learners in classrooms, churches, workplaces and online cohorts across Uganda — and every graduate becomes a bridge between Deaf and hearing communities."
            />
            {verifiedStats.length > 0 && (
              <dl className="mt-8 grid grid-cols-2 gap-4">
                {verifiedStats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-ink-200 p-4">
                    <dd className="font-display text-3xl font-bold text-brand-700">{s.value}</dd>
                    <dt className="mt-1 text-sm text-ink-600">{s.label}</dt>
                  </div>
                ))}
                {impact_stats.asOf && <p className="col-span-2 text-xs text-ink-500">Figures as of {impact_stats.asOf}, published by MCSLI.</p>}
              </dl>
            )}
            <ButtonLink to="/impact" variant="secondary" className="mt-8">
              Read all impact stories
            </ButtonLink>
          </div>
          <div className="grid gap-5 sm:grid-cols-3 lg:col-span-7">
            {featured.map((s) => (
              <StoryCard key={s.slug} story={s} compact />
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------- Why learn ---------------- */}
      <Section tone="muted">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <img src="/media/gallery/team-outdoor-training.jpg" alt="MCSLI team members practising signs together outdoors, smiling and signing in a group." loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-raised" width={1200} height={900} />
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeader eyebrow="Why learn sign language?" title="A few signs can open a door. Fluency can change a life." />
            <ul className="mt-8 space-y-5">
              {[
                { icon: MessageCircleHeart, t: 'Inclusion starts with you', d: 'Deaf people should not have to earn inclusion by adapting to us. Learning USL is the most direct way to meet them halfway — at home, at school, at work.' },
                { icon: Briefcase, t: 'Opportunity', d: 'Health workers, teachers, police, pastors, customer-facing staff and interpreters all serve Deaf Ugandans better with sign language — and stand out for it.' },
                { icon: HeartHandshake, t: 'Community', d: 'Our learners describe the Deaf community as welcoming, funny, creative and patient. Sign language is the invitation.' },
                { icon: Megaphone, t: 'Advocacy', d: 'Every fluent hearing signer strengthens the case for Deaf rights, accessible services and inclusive policy in Uganda.' },
              ].map((i) => (
                <li key={i.t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-card" aria-hidden="true">
                    <i.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-ink-900">{i.t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{i.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ---------------- Learning experience ---------------- */}
      <Section>
        <SectionHeader align="center" eyebrow="The learning experience" title="Designed for phones, slow connections and real progress" description="No gimmicks — clear lessons, honest feedback from trainers, and a certificate employers can verify." />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {experience.map((f) => (
            <li key={f.title} className="flex gap-4 rounded-2xl border border-ink-200 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600" aria-hidden="true">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-sm text-ink-500">
          AI-assisted practice feedback is in development and will be clearly labelled when it arrives.{' '}
          <Link to="/online-learning#ai" className="font-semibold text-brand-700 hover:underline">
            Learn more
          </Link>
        </p>
      </Section>

      <CtaBand />
    </>
  );
}
