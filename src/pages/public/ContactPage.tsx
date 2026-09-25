import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, ExternalLink } from 'lucide-react';
import { z } from 'zod';
import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { submitContactMessage } from '@/services/public';
import { isSupabaseConfigured, friendlyError } from '@/lib/supabase';
import { Section, PageHero } from '@/components/public/Sections';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Misc';

const topics = [
  { value: 'general', label: 'General information' },
  { value: 'training', label: 'Training programmes' },
  { value: 'online', label: 'Online course' },
  { value: 'volunteer', label: 'Volunteer or internship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'donation', label: 'Donations' },
  { value: 'media', label: 'Media enquiry' },
  { value: 'other', label: 'Other' },
];

const schema = z.object({
  full_name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().email('Enter a valid e-mail address'),
  phone: z.string().trim().max(30).optional(),
  topic: z.string(),
  subject: z.string().trim().min(3, 'Add a short subject').max(150),
  body: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(4000),
  availability: z.string().optional(),
  country: z.string().optional(),
});

export default function ContactPage() {
  const { content } = useSiteContent();
  const { contact, organisation: org } = content;
  const [params] = useSearchParams();
  const [topic, setTopic] = useState(params.get('topic') ?? 'general');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  usePageMeta({ title: 'Contact MCSLI', description: `Contact MCSLI in Kampala: ${contact.address}. Phone ${contact.phone}, e-mail ${contact.email}.`, path: '/contact' });

  const isVolunteer = topic === 'volunteer';

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
    const parsed = schema.safeParse({ ...raw, topic });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0]!)?.focus();
      return;
    }
    setErrors({});
    setState('sending');
    try {
      const d = parsed.data;
      await submitContactMessage({
        kind: isVolunteer ? 'volunteer' : topic === 'partnership' ? 'partner' : 'contact',
        full_name: d.full_name,
        email: d.email,
        phone: d.phone,
        subject: `[${topics.find((t) => t.value === topic)?.label ?? topic}] ${d.subject}`,
        body: d.body,
        metadata: { topic, availability: d.availability, country: d.country },
      });
      setState('sent');
    } catch (err) {
      setErrorMsg(friendlyError(err));
      setState('error');
    }
  };

  return (
    <>
      <PageHero eyebrow="Get in touch" title="Contact MCSLI" description="Whether you have questions, want to get involved, or need support, our team is here to help you connect with our mission." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="card p-5">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Our office</h2>
                  <p className="mt-1 text-sm text-ink-600">{contact.address}</p>
                  <a href={`https://maps.google.com/?q=${contact.mapQuery}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                    Get directions <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-700" aria-hidden="true">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Phone, WhatsApp & SMS</h2>
                  <a href={`tel:${contact.phoneIntl}`} className="mt-1 block text-sm text-brand-700 hover:underline">
                    {contact.phone}
                  </a>
                  <p className="text-xs text-ink-500">WhatsApp and SMS are welcome — video calls in USL too.</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600" aria-hidden="true">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">E-mail</h2>
                  <a href={`mailto:${contact.email}`} className="mt-1 block text-sm text-brand-700 hover:underline">
                    {contact.email}
                  </a>
                  <p className="text-xs text-ink-500">We respond within 24 hours on working days.</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-700" aria-hidden="true">
                  <Clock className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h2 className="font-semibold">Working hours</h2>
                  <dl className="mt-1 space-y-0.5 text-sm">
                    {contact.hours.map((h) => (
                      <div key={h.days} className="flex justify-between gap-4">
                        <dt className="text-ink-600">{h.days}</dt>
                        <dd className="text-ink-900">{h.hours}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-500">
              {org.name} · {org.registrar} registration no. {org.registrationNumber}
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="card p-6 sm:p-8">
              <h2 className="text-xl font-semibold">{isVolunteer ? 'Volunteer & internship application' : 'Send us a message'}</h2>
              <p className="mt-1 text-sm text-ink-600">{isVolunteer ? 'We welcome applications from Ugandan and international volunteers and interns.' : 'Fill in the form and we will get back to you.'}</p>
              {state === 'sent' ? (
                <Alert tone="success" title="Message sent" className="mt-6">
                  Thank you — MCSLI has received your message and will reply to {'your e-mail'} soon.
                </Alert>
              ) : !isSupabaseConfigured ? (
                <Alert tone="info" title="Online form unavailable" className="mt-6">
                  Please e-mail us at <a className="font-semibold underline" href={`mailto:${contact.email}`}>{contact.email}</a> or call {contact.phone}.
                </Alert>
              ) : (
                <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input id="full_name" name="full_name" label="Full name" required autoComplete="name" error={errors.full_name} />
                    <Input id="email" name="email" type="email" label="E-mail address" required autoComplete="email" error={errors.email} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input id="phone" name="phone" type="tel" label="Phone number" optionalLabel autoComplete="tel" placeholder="+256 …" error={errors.phone} />
                    <Select id="topic" name="topic" label="Type of enquiry" required value={topic} onChange={(e) => setTopic(e.target.value)} options={topics} />
                  </div>
                  {isVolunteer && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Input id="country" name="country" label="Country" required autoComplete="country-name" />
                      <Select
                        id="availability"
                        name="availability"
                        label="Availability"
                        required
                        placeholder="Select availability"
                        options={[
                          { value: 'part-time', label: 'Part-time (10–20 hours/week)' },
                          { value: 'full-time', label: 'Full-time (40+ hours/week)' },
                          { value: 'weekends', label: 'Weekends only' },
                          { value: 'flexible', label: 'Flexible schedule' },
                        ]}
                      />
                    </div>
                  )}
                  <Input id="subject" name="subject" label={isVolunteer ? 'Skills / area of interest' : 'Subject'} required error={errors.subject} />
                  <Textarea id="body" name="body" label={isVolunteer ? 'Why do you want to volunteer or intern with MCSLI?' : 'Message'} required rows={6} error={errors.body} />
                  {state === 'error' && (
                    <Alert tone="danger" title="Could not send your message">
                      {errorMsg} You can also e-mail {contact.email}.
                    </Alert>
                  )}
                  <Button type="submit" size="lg" loading={state === 'sending'}>
                    {isVolunteer ? 'Submit application' : 'Send message'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
