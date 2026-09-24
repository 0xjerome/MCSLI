import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LifeBuoy, Mail, Phone, MessageSquarePlus } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSiteContent } from '@/content/useSiteContent';
import { listTickets, createTicket } from '@/services/community';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/Misc';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { TicketStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { cn, relativeTime } from '@/lib/utils';
import type { TicketCategory } from '@/domain/types';

const categories: { value: TicketCategory; label: string }[] = [
  { value: 'payment', label: 'Payment help' },
  { value: 'course', label: 'Course help' },
  { value: 'identity', label: 'Identity verification' },
  { value: 'technical', label: 'Technical problem' },
  { value: 'other', label: 'Something else' },
];

export default function HelpPage() {
  const { user } = useAuth();
  const { content } = useSiteContent();
  const qc = useQueryClient();
  const toast = useToast();
  const tickets = useQuery({ queryKey: ['my-tickets'], queryFn: () => listTickets() });
  const [tab, setTab] = useState<'faq' | 'tickets' | 'new'>('faq');
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageMeta({ title: 'Help & support', noIndex: true });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await createTicket({ userId: user.id, category: String(fd.get('category')) as TicketCategory, subject: String(fd.get('subject')), body: String(fd.get('body')) });
      await qc.invalidateQueries({ queryKey: ['my-tickets'] });
      toast.success('Support request sent', 'MCSLI will reply here and you will be notified.');
      setTab('tickets');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const faqCats = Array.from(new Set(content.faq.map((f) => f.category)));

  return (
    <>
      <PageHeader eyebrow="Help" title="Help & support" description="Answers to common questions, and a direct line to the MCSLI team." actions={<Button onClick={() => setTab('new')} leftIcon={<MessageSquarePlus className="h-4 w-4" aria-hidden="true" />}>New support request</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr,18rem]">
        <div>
          <Tabs aria-label="Help sections" value={tab} onChange={setTab} tabs={[{ id: 'faq', label: 'FAQs' }, { id: 'tickets', label: 'My requests', count: tickets.data?.length }, { id: 'new', label: 'New request' }]} />
          <TabPanel id="faq" value={tab} className="mt-6 space-y-6">
            {faqCats.map((c) => (
              <div key={c}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">{c}</h2>
                <ul className="mt-2 divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
                  {content.faq
                    .filter((f) => f.category === c)
                    .map((f) => {
                      const id = `${c}-${f.question}`;
                      const open = openQ === id;
                      return (
                        <li key={id}>
                          <h3>
                            <button type="button" aria-expanded={open} aria-controls={`p-${id}`} onClick={() => setOpenQ(open ? null : id)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-ink-900 hover:bg-ink-50">
                              {f.question}
                              <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                            </button>
                          </h3>
                          {open && (
                            <p id={`p-${id}`} className="px-4 pb-4 text-sm leading-relaxed text-ink-600">
                              {f.answer}
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </TabPanel>
          <TabPanel id="tickets" value={tab} className="mt-6">
            {tickets.isLoading ? (
              <Skeleton lines={4} />
            ) : (tickets.data ?? []).length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No support requests yet" description="If FAQs don't answer your question, open a request and MCSLI will reply here." action={<Button variant="outline" onClick={() => setTab('new')}>New request</Button>} />
            ) : (
              <ul className="divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
                {(tickets.data ?? []).map((t) => (
                  <li key={t.id}>
                    <Link to={`/app/help/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-900">{t.subject}</span>
                        <span className="text-xs text-ink-500">
                          {categories.find((c) => c.value === t.category)?.label} · updated {relativeTime(t.updated_at)}
                        </span>
                      </span>
                      <TicketStatusBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
          <TabPanel id="new" value={tab} className="mt-6">
            <Card>
              <CardHeader title="New support request" description="Include your transaction reference for payment questions." />
              <form onSubmit={submit} className="space-y-4">
                <Select name="category" label="Category" required options={categories} defaultValue="course" />
                <Input name="subject" label="Subject" required minLength={3} maxLength={200} />
                <Textarea name="body" label="Describe the issue" required minLength={5} rows={6} />
                {error && <Alert tone="danger">{error}</Alert>}
                <Button type="submit" loading={busy}>
                  Send request
                </Button>
              </form>
            </Card>
          </TabPanel>
        </div>
        <aside className="space-y-4">
          <Card padding="sm" className="p-5">
            <h2 className="font-semibold">Contact MCSLI directly</h2>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <a href={`tel:${content.contact.phoneIntl}`} className="text-brand-700 hover:underline">
                {content.contact.phone}
              </a>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <a href={`mailto:${content.contact.email}`} className="text-brand-700 hover:underline">
                {content.contact.email}
              </a>
            </p>
            <p className="mt-2 text-xs text-ink-500">WhatsApp, SMS and video calls in USL are welcome. {content.contact.hours[0]?.days} {content.contact.hours[0]?.hours}.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
