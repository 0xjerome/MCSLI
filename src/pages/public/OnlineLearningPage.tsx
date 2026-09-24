import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, Sparkles, Smartphone, Captions, Video, Hand, ListChecks, ClipboardCheck, Award, MessageSquare } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { formatUGX } from '@/lib/utils';
import { listPublishedCourses, fallbackCourseFees } from '@/services/public';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero, CtaBand } from '@/components/public/Sections';
import { SectionHeader } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { splitInstallments } from '@/domain/pricing';

export default function OnlineLearningPage() {
  const { content } = useSiteContent();
  const courses = useQuery({ queryKey: ['public-courses'], queryFn: listPublishedCourses });
  const course = courses.data?.[0];
  const fees = course
    ? { ...course }
    : { ...fallbackCourseFees, id: undefined as string | undefined, installment_due_before_month: { '2': 2 } as Record<string, number> };
  usePageMeta({
    title: 'Online Sign Language Course',
    description: 'Learn Ugandan Sign Language online with MCSLI: captioned video lessons, practice signs, quizzes, monthly trainer assessments and a verifiable certificate.',
    path: '/online-learning',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: fees.title,
      description: 'Online Ugandan Sign Language course by MCSLI',
      provider: { '@type': 'Organization', name: 'Master Class Sign Language Initiative', sameAs: 'https://mcsli.org' },
      inLanguage: 'en',
      offers: [
        { '@type': 'Offer', price: fees.tuition_national, priceCurrency: fees.currency, category: 'Ugandan students' },
        { '@type': 'Offer', price: fees.tuition_international, priceCurrency: fees.currency, category: 'International students' },
      ],
    },
  });

  const natInst = splitInstallments(fees.tuition_national, fees.installment_count ?? 2);
  const intlInst = splitInstallments(fees.tuition_international, fees.installment_count ?? 2);
  const faqs = content.faq.filter((f) => ['Course', 'Payment'].includes(f.category)).slice(0, 5);

  return (
    <>
      <PageHero
        eyebrow="MCSLI Online"
        title="Learn Ugandan Sign Language online — with real trainers"
        description="Month-by-month video lessons, practice signs and quizzes, plus a live assessment with an MCSLI trainer at the end of every month. Pay by bank, MTN or Airtel; study from any phone."
        image="/media/gallery/online-cohort-1.jpg"
        imageAlt="A screenshot of an MCSLI online cohort session showing the course title slide and a trainer on video."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/register" variant="accent" size="lg" rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
            Register now
          </ButtonLink>
          <ButtonLink to="#fees" variant="outline" size="lg">
            See fees
          </ButtonLink>
        </div>
      </PageHero>

      <Section>
        <SectionHeader eyebrow="How the course works" title="Progress one month at a time" description="Every month must be completed — lessons, quizzes and a trainer assessment — before the next one opens. It keeps the learning honest and the certificate meaningful." />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { n: 1, t: 'Learn & practise', d: 'Watch the month’s captioned lessons, replay signs slowly and practise beside the reference video.' },
            { n: 2, t: 'Quizzes', d: 'Check your understanding with quizzes that give instant feedback and explanations.' },
            { n: 3, t: 'Trainer assessment', d: 'Meet an MCSLI trainer online for your monthly assessment. A pass unlocks the next month; otherwise you review and are reassessed.' },
          ].map((s) => (
            <li key={s.n} className="card p-6">
              <span className="font-display text-3xl font-bold text-brand-200">0{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
          <Lock className="h-4 w-4 text-ink-500" aria-hidden="true" />
          <span>
            Months stay locked until <strong>both</strong> the previous assessment is passed <strong>and</strong> the payment due for that month is confirmed. The platform always tells you exactly why something is locked.
          </span>
        </div>
      </Section>

      <Section tone="muted" id="fees">
        <SectionHeader eyebrow="Fees" title="Transparent pricing" description={`A one-time registration fee plus tuition. Tuition can be paid in full or in ${fees.installment_count ?? 2} installments.`} />
        {courses.isLoading && <p className="mt-6 text-sm text-ink-500">Loading current fees…</p>}
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {[
            { label: 'Ugandan online student', tuition: fees.tuition_national, inst: natInst, note: 'Requires a valid National ID (NIN) for identity verification.' },
            { label: 'Non-Ugandan online student', tuition: fees.tuition_international, inst: intlInst, note: 'Requires a passport or other approved identification.' },
          ].map((p) => (
            <div key={p.label} className="card p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">{p.label}</p>
              <p className="mt-3 font-display text-3xl font-bold text-ink-900">{formatUGX(p.tuition, fees.currency)}</p>
              <p className="text-sm text-ink-500">tuition · {fees.duration_months}-month course</p>
              <dl className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between border-b border-ink-100 pb-2">
                  <dt className="text-ink-600">Registration fee (one-time, separate)</dt>
                  <dd className="font-semibold text-ink-900">{formatUGX(fees.registration_fee, fees.currency)}</dd>
                </div>
                <div className="flex justify-between border-b border-ink-100 pb-2">
                  <dt className="text-ink-600">Pay in full</dt>
                  <dd className="font-semibold text-ink-900">{formatUGX(p.tuition, fees.currency)}</dd>
                </div>
                {fees.installments_enabled && (
                  <div className="flex justify-between">
                    <dt className="text-ink-600">Or {p.inst.length} installments</dt>
                    <dd className="text-right font-semibold text-ink-900">{p.inst.map((a, i) => `${formatUGX(a, fees.currency)}${i === 0 ? ' before Month 1' : ` before Month ${fees.installment_due_before_month?.[String(i + 1)] ?? i + 1}`}`).join(' · ')}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs text-ink-500">{p.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-600">
          Payment methods: MCSLI bank account, MTN MoMo Pay and Airtel Pay. Every payment is confirmed by an MCSLI administrator, and you get a receipt number in the app.{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">
            Register to see payment details.
          </Link>
        </p>
      </Section>

      <Section>
        <SectionHeader eyebrow="What you get" title="Everything in one place" />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Video, t: 'Captioned lessons', d: 'Every lesson video has captions and a transcript.' },
            { icon: Hand, t: 'Practice signs', d: 'Slow playback, mirror mode and optional side-by-side camera.' },
            { icon: ListChecks, t: 'Quizzes', d: 'Multiple choice, video-based and matching questions.' },
            { icon: ClipboardCheck, t: 'Trainer assessments', d: 'Monthly live assessments with written feedback.' },
            { icon: MessageSquare, t: 'Discussions', d: 'Ask questions and learn from other students and trainers.' },
            { icon: Smartphone, t: 'Mobile first', d: 'Built for phones and slower connections.' },
            { icon: Captions, t: 'Accessible', d: 'Keyboard navigation, screen-reader labels, reduced motion.' },
            { icon: Award, t: 'Verifiable certificate', d: 'Unique number and QR code anyone can check on mcsli.org.' },
          ].map((f) => (
            <li key={f.t} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm text-ink-600">{f.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted" id="ai">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <Badge tone="accent" icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}>Coming soon</Badge>
            <h2 className="mt-3 text-display-sm">AI-powered learning features</h2>
            <p className="mt-4 leading-relaxed text-ink-600">
              MCSLI plans to add AI assistance to the platform — for example hints on hand shape or movement while you practise, or smarter review suggestions. These features are not available yet, and when they arrive they will be clearly labelled as assistance. Assessment and certification will always be done by qualified MCSLI trainers.
            </p>
          </div>
          <ul className="space-y-3">
            {['Practice hints on hand shape and movement', 'Personalised revision suggestions', 'Searchable sign dictionary'].map((f) => (
              <li key={f} className="flex items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-white p-4 text-sm text-ink-700">
                <Sparkles className="h-4 w-4 shrink-0 text-accent-500" aria-hidden="true" /> {f} <Badge size="sm" className="ml-auto">Planned</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="FAQ" title="Common questions" />
        <dl className="mt-8 divide-y divide-ink-200 border-y border-ink-200">
          {faqs.map((f) => (
            <div key={f.question} className="grid gap-2 py-5 md:grid-cols-12">
              <dt className="font-semibold text-ink-900 md:col-span-5">{f.question}</dt>
              <dd className="text-sm leading-relaxed text-ink-600 md:col-span-7">{f.answer}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-brand-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-brand-600" aria-hidden="true" />
            <p className="font-semibold text-ink-900">Ready to start? Registration takes about five minutes.</p>
          </div>
          <ButtonLink to="/register" variant="accent">
            Start Learning
          </ButtonLink>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
