import { CheckCircle2, Target, Eye } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero, CtaBand } from '@/components/public/Sections';
import { SectionHeader, Avatar, DescriptionList } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';

export default function AboutPage() {
  const { content } = useSiteContent();
  const { organisation: org, team } = content;
  usePageMeta({ title: 'About MCSLI', description: `${org.name} is a ${org.leadership} non-profit founded in ${org.foundedYear} in Kampala, Uganda. ${org.mission}`, path: '/about' });

  return (
    <>
      <PageHero
        eyebrow="Our story"
        title="A Deaf-led organisation building bridges through sign language"
        description={`Founded in ${org.foundedYear} and registered with the ${org.registrar} in ${org.registeredYear}, MCSLI believes communication is a human right.`}
        image="/media/gallery/team-standing-together.jpg"
        imageAlt="The MCSLI team standing together outdoors at a community outreach event."
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="prose-mcsli lg:col-span-7">
            <SectionHeader eyebrow="Who we are" title="Communication is a human right" />
            <p className="mt-6 text-lg">
              MCSLI is a non-profit organisation founded in {org.foundedYear} and officially registered with the {org.registrar} in {org.registeredYear} — registration number {org.registrationNumber}.
            </p>
            <p>
              We are committed to providing equal opportunities for Deaf and Hard of Hearing individuals in Uganda. We believe communication is a human right, and through sign language, we bridge the gap between Deaf and hearing communities.
            </p>
            <p className="rounded-xl border-l-4 border-accent-500 bg-accent-50 p-4 font-display text-lg font-semibold text-accent-800">“{org.slogan}”</p>
          </div>
          <aside className="card h-fit p-6 lg:col-span-5">
            <h2 className="text-lg font-semibold">Organisation details</h2>
            <DescriptionList
              className="mt-4"
              columns={1}
              items={[
                { label: 'Founded', value: org.foundedYear },
                { label: 'Officially registered', value: `${org.registeredYear} (${org.registrar})` },
                { label: 'Registration number', value: <span className="font-mono">{org.registrationNumber}</span> },
                { label: 'Type', value: org.type },
                { label: 'Leadership', value: org.leadership },
                { label: 'Based in', value: content.contact.addressShort },
              ]}
            />
          </aside>
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-6 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
              <Target className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Our mission</h2>
            <p className="mt-2 leading-relaxed text-ink-600">{org.mission}</p>
          </div>
          <div className="card p-6 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600" aria-hidden="true">
              <Eye className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Our vision</h2>
            <p className="mt-2 leading-relaxed text-ink-600">{org.vision}</p>
          </div>
        </div>
        <figure className="mt-6 rounded-2xl bg-brand-900 p-6 text-white sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-300">Founder's Vision 2040</p>
          <blockquote className="mt-4 max-w-3xl font-display text-xl font-semibold leading-snug sm:text-2xl">“{org.vision2040.quote}”</blockquote>
          <figcaption className="mt-4 text-sm text-brand-100">
            — {org.vision2040.author}, {org.vision2040.title}
          </figcaption>
        </figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="Our foundation" title="Core values" description="These values guide our work and define who we are as an organisation." />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {org.coreValues.map((v) => (
            <li key={v} className="flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              {v}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted" id="team">
        <SectionHeader eyebrow="Meet us" title="Our team" description="The people working to empower the Deaf community and create a more inclusive Uganda." />
        <h3 className="mt-10 text-sm font-semibold uppercase tracking-wider text-ink-500">Leadership</h3>
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {team.leadership.map((m) => (
            <li key={m.name} className="card overflow-hidden p-0">
              {m.image ? (
                <img src={m.image} alt={`Portrait of ${m.name}`} loading="lazy" className="aspect-square w-full object-cover object-top" width={600} height={600} />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-ink-100">
                  <Avatar name={m.name} size="xl" />
                </div>
              )}
              <div className="p-4">
                <p className="font-semibold text-ink-900">{m.name}</p>
                <p className="text-sm text-brand-700">{m.position}</p>
              </div>
            </li>
          ))}
        </ul>
        <h3 className="mt-10 text-sm font-semibold uppercase tracking-wider text-ink-500">Team members</h3>
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {team.members.map((m) => (
            <li key={m.name} className="card flex items-center gap-4 p-4">
              <Avatar name={m.name} src={m.image} size="lg" />
              <div>
                <p className="font-semibold text-ink-900">{m.name}</p>
                <p className="text-sm text-brand-700">{m.position}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-2xl border border-ink-200 bg-white p-6 sm:flex sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Volunteer or intern with MCSLI</h3>
            <p className="mt-1 text-sm text-ink-600">We welcome volunteers and interns from Uganda and around the world who share our passion for an inclusive society.</p>
          </div>
          <ButtonLink to="/contact?topic=volunteer" className="mt-4 sm:mt-0">
            Apply to volunteer
          </ButtonLink>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
