import { useState } from 'react';
import { Calendar, Clock, Award, CheckCircle2, Hand } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero, ProgramCard, CtaBand, iconMap } from '@/components/public/Sections';
import { SectionHeader } from '@/components/ui/Misc';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type Tab = 'training' | 'empowerment' | 'advocacy' | 'technology';

export default function ProgramsPage() {
  const { content } = useSiteContent();
  const { programs } = content;
  const [tab, setTab] = useState<Tab>('training');
  usePageMeta({ title: 'Programs', description: programs.intro, path: '/programs' });

  return (
    <>
      <PageHero eyebrow="Programs" title="Sign language training, empowerment and advocacy" description="Comprehensive programmes designed to promote sign language learning, empower the Deaf community and create inclusive opportunities for all." image="/media/gallery/classroom-sign-language-training.jpg" imageAlt="An MCSLI trainer teaching Ugandan Sign Language vocabulary at a blackboard in a classroom." />

      <Section>
        <Tabs
          aria-label="Program categories"
          variant="pills"
          value={tab}
          onChange={setTab}
          className="w-fit"
          tabs={[
            { id: 'training', label: 'Sign Language Training' },
            { id: 'empowerment', label: 'Youth & Women Empowerment' },
            { id: 'advocacy', label: 'Advocacy & Awareness' },
            { id: 'technology', label: 'Technology for Inclusion' },
          ]}
        />

        <TabPanel id="training" value={tab} className="mt-10">
          <SectionHeader title="Sign language training programs" description={programs.intro} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.training.map((p) => (
              <ProgramCard key={p.slug} program={p} />
            ))}
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h3 className="text-xl font-semibold">Training schedule</h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                {programs.schedule.map((s) => (
                  <li key={s.type} className="card p-5">
                    <p className="font-semibold text-ink-900">{s.type}</p>
                    <p className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                      <Calendar className="h-4 w-4 text-brand-600" aria-hidden="true" /> {s.days}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-700">
                      <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" /> {s.time}
                    </p>
                    <p className="mt-2 text-xs text-ink-500">{s.format}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-accent-200 bg-accent-50 p-6 lg:col-span-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-accent-600 shadow-card" aria-hidden="true">
                <Award className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">Certificate award</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{programs.certificateNote}</p>
              <ButtonLink to="/online-learning" variant="accent" className="mt-5">
                Learn online
              </ButtonLink>
            </div>
          </div>
        </TabPanel>

        <TabPanel id="empowerment" value={tab} className="mt-10">
          <SectionHeader title="Youth & Women Empowerment" description="Developing leadership skills and providing opportunities for Deaf youth and women to thrive in their personal and professional lives." />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {programs.empowerment.map((p) => (
              <article key={p.title} className="card p-6">
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{p.description}</p>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-ink-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" /> {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </TabPanel>

        <TabPanel id="advocacy" value={tab} className="mt-10">
          <SectionHeader title="Advocacy & awareness" description="Championing equal rights and creating awareness about Deaf culture and accessibility needs across Uganda." />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.focusAreas.map((a) => {
              const Icon = iconMap[a.icon] ?? Hand;
              return (
                <article key={a.title} className="card p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{a.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{a.description}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl">
            <img src="/media/gallery/sign-up-for-sign-language-rights.jpg" alt='A young person wearing a white t-shirt printed with "Sign Up For Sign Language Rights" during an MCSLI advocacy campaign.' loading="lazy" className="aspect-[21/9] w-full object-cover" width={1200} height={514} />
          </div>
        </TabPanel>

        <TabPanel id="technology" value={tab} className="mt-10">
          <SectionHeader title="Technology for inclusion" description="Leveraging technology to create accessible learning experiences and improve communication opportunities for the Deaf community." />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <article className="card p-6">
              <Badge tone="success">Available now</Badge>
              <h3 className="mt-3 text-lg font-semibold">Online learning platform</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">Month-by-month USL courses with captioned video lessons, practice signs, quizzes, trainer assessments, progress tracking and verifiable certificates.</p>
              <ButtonLink to="/online-learning" variant="secondary" size="sm" className="mt-4">
                Explore the platform
              </ButtonLink>
            </article>
            <article className="card p-6">
              <Badge tone="accent">Coming soon</Badge>
              <h3 className="mt-3 text-lg font-semibold">AI-assisted practice feedback</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">We are exploring AI tools that could give learners hints on hand shape and movement while they practise. Until it is reliable for USL, all assessment stays with MCSLI trainers.</p>
            </article>
            <article className="card p-6">
              <Badge tone="accent">Coming soon</Badge>
              <h3 className="mt-3 text-lg font-semibold">Mobile app</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">The learning platform already works on any phone browser. A dedicated app with offline lesson downloads is on our roadmap.</p>
            </article>
          </div>
        </TabPanel>
      </Section>

      <CtaBand />
    </>
  );
}
