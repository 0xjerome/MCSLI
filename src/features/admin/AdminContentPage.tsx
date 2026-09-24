import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Globe, CalendarDays, Pencil } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { listSiteContent, setSiteContent, listAllEvents, saveEvent, deleteEvent } from '@/services/staff';
import { contentSchemas, type ContentKey, type SiteContent } from '@/content/schema';
import { defaultContent } from '@/content/defaults';
import { mergeContent } from '@/content/useSiteContent';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea, Checkbox } from '@/components/ui/Field';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Alert, Skeleton, ErrorState, EmptyState } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import type { EventRow, Json } from '@/types/database';

type Tab = 'contact' | 'impact' | 'announcements' | 'hero' | 'events' | 'advanced';

export default function AdminContentPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const rows = useQuery({ queryKey: ['site-content-admin'], queryFn: listSiteContent });
  const [tab, setTab] = useState<Tab>('contact');
  usePageMeta({ title: 'Website content', noIndex: true });

  const content = useMemo(() => mergeContent(rows.data), [rows.data]);
  const overridden = new Set((rows.data ?? []).map((r) => r.key));

  const save = async <K extends ContentKey>(key: K, value: SiteContent[K]) => {
    const parsed = contentSchemas[key].safeParse(value);
    if (!parsed.success) {
      toast.error('Invalid content', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join('; '));
      return false;
    }
    try {
      await setSiteContent(key, parsed.data as Json);
      await Promise.all([rows.refetch(), qc.invalidateQueries({ queryKey: ['site-content'] })]);
      toast.success('Published', 'The public website now shows the new content.');
      return true;
    } catch (err) {
      toast.error('Could not save', friendlyError(err));
      return false;
    }
  };

  if (rows.isLoading) return <Skeleton className="h-96" />;
  if (rows.isError) return <ErrorState onRetry={() => rows.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Website" title="Public website content" description="Edit what visitors see on mcsli.org without touching code. Values fall back to the built-in defaults until you override them." />
      <Tabs aria-label="Content sections" value={tab} onChange={setTab} className="mb-6" tabs={[{ id: 'contact', label: 'Contact details' }, { id: 'impact', label: 'Impact statistics' }, { id: 'announcements', label: 'Announcements' }, { id: 'hero', label: 'Homepage hero' }, { id: 'events', label: 'Events' }, { id: 'advanced', label: 'All content (JSON)' }]} />

      <TabPanel id="contact" value={tab}>
        <ContactEditor value={content.contact} overridden={overridden.has('contact')} onSave={(v) => save('contact', v)} />
      </TabPanel>
      <TabPanel id="impact" value={tab}>
        <ImpactEditor value={content.impact_stats} overridden={overridden.has('impact_stats')} onSave={(v) => save('impact_stats', v)} />
      </TabPanel>
      <TabPanel id="announcements" value={tab}>
        <AnnouncementsEditor value={content.announcements} onSave={(v) => save('announcements', v)} />
      </TabPanel>
      <TabPanel id="hero" value={tab}>
        <HeroEditor value={content.hero} overridden={overridden.has('hero')} onSave={(v) => save('hero', v)} />
      </TabPanel>
      <TabPanel id="events" value={tab}>
        <EventsEditor />
      </TabPanel>
      <TabPanel id="advanced" value={tab}>
        <JsonEditor content={content} overridden={overridden} onSave={save} />
      </TabPanel>
    </>
  );
}

function ContactEditor({ value, overridden, onSave }: { value: SiteContent['contact']; overridden: boolean; onSave: (v: SiteContent['contact']) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    await onSave({
      ...value,
      address: String(fd.get('address')),
      addressShort: String(fd.get('addressShort')),
      phone: String(fd.get('phone')),
      phoneIntl: String(fd.get('phoneIntl')),
      whatsapp: String(fd.get('whatsapp')) || undefined,
      email: String(fd.get('email')),
      website: String(fd.get('website')),
      mapQuery: String(fd.get('mapQuery')),
      social: { facebook: String(fd.get('facebook')) || undefined, x: String(fd.get('x')) || undefined, instagram: String(fd.get('instagram')) || undefined, linkedin: String(fd.get('linkedin')) || undefined, youtube: String(fd.get('youtube')) || undefined },
      hours: [0, 1, 2].map((i) => ({ days: String(fd.get(`hours_days_${i}`)), hours: String(fd.get(`hours_${i}`)) })).filter((h) => h.days),
    });
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader title="Contact details" description="Shown in the footer, contact page and structured data." action={overridden ? <Badge tone="success">Customised</Badge> : <Badge>Defaults</Badge>} />
      <form onSubmit={submit} className="space-y-4">
        <Input name="address" label="Full address" defaultValue={value.address} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="addressShort" label="Short address" defaultValue={value.addressShort} required />
          <Input name="mapQuery" label="Google Maps query" defaultValue={value.mapQuery} required />
          <Input name="phone" label="Phone (display)" defaultValue={value.phone} required />
          <Input name="phoneIntl" label="Phone (international format)" defaultValue={value.phoneIntl} required />
          <Input name="whatsapp" label="WhatsApp" defaultValue={value.whatsapp ?? ''} optionalLabel />
          <Input name="email" label="E-mail" type="email" defaultValue={value.email} required />
          <Input name="website" label="Website" defaultValue={value.website} required />
        </div>
        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-sm font-semibold">Social links</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="facebook" label="Facebook URL" defaultValue={value.social.facebook ?? ''} optionalLabel />
            <Input name="x" label="X (Twitter) URL" defaultValue={value.social.x ?? ''} optionalLabel />
            <Input name="instagram" label="Instagram URL" defaultValue={value.social.instagram ?? ''} optionalLabel />
            <Input name="linkedin" label="LinkedIn URL" defaultValue={value.social.linkedin ?? ''} optionalLabel />
            <Input name="youtube" label="YouTube URL" defaultValue={value.social.youtube ?? ''} optionalLabel />
          </div>
        </fieldset>
        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-sm font-semibold">Working hours</legend>
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <Input name={`hours_days_${i}`} label={`Days ${i + 1}`} defaultValue={value.hours[i]?.days ?? ''} />
                <Input name={`hours_${i}`} label={`Hours ${i + 1}`} defaultValue={value.hours[i]?.hours ?? ''} />
              </div>
            ))}
          </div>
        </fieldset>
        <Button type="submit" loading={busy}>
          Publish contact details
        </Button>
      </form>
    </Card>
  );
}

function ImpactEditor({ value, overridden, onSave }: { value: SiteContent['impact_stats']; overridden: boolean; onSave: (v: SiteContent['impact_stats']) => Promise<boolean> }) {
  const [stats, setStats] = useState(value.stats);
  const [asOf, setAsOf] = useState(value.asOf ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStats(value.stats);
    setAsOf(value.asOf ?? '');
  }, [value]);
  return (
    <Card>
      <CardHeader title="Impact statistics" description="Only statistics marked VERIFIED are shown on the public website. The repository and the old website disagreed on these numbers, so please confirm each one against MCSLI records." action={overridden ? <Badge tone="success">Customised</Badge> : <Badge>Defaults</Badge>} />
      <Alert tone="warning" className="mb-4" title="Currently hidden from the public site">
        {stats.some((s) => s.verified) ? `${stats.filter((s) => s.verified).length} of ${stats.length} statistics are verified and visible.` : 'No statistic is verified yet, so the impact numbers are not displayed publicly.'}
      </Alert>
      <div className="space-y-3">
        {stats.map((s, i) => (
          <div key={i} className="grid gap-3 rounded-xl border border-ink-200 p-3 sm:grid-cols-[1fr,8rem,1fr,auto,auto] sm:items-end">
            <Input label="Label" value={s.label} onChange={(e) => setStats((a) => a.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input label="Value" value={s.value} onChange={(e) => setStats((a) => a.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <Input label="Note (internal)" value={s.note ?? ''} onChange={(e) => setStats((a) => a.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} optionalLabel />
            <Checkbox label="Verified" checked={s.verified} onChange={(e) => setStats((a) => a.map((x, j) => (j === i ? { ...x, verified: e.target.checked } : x)))} className="pb-3" />
            <Button variant="ghost" size="sm" aria-label="Remove statistic" onClick={() => setStats((a) => a.filter((_, j) => j !== i))} className="mb-1.5">
              <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setStats((a) => [...a, { label: '', value: '', verified: false }])}>
          Add statistic
        </Button>
        <Input label="As of (shown publicly)" value={asOf} onChange={(e) => setAsOf(e.target.value)} wrapperClassName="w-40" placeholder="e.g. 2025" />
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ asOf: asOf || undefined, stats });
            setBusy(false);
          }}
        >
          Publish statistics
        </Button>
      </div>
    </Card>
  );
}

function AnnouncementsEditor({ value, onSave }: { value: SiteContent['announcements']; onSave: (v: SiteContent['announcements']) => Promise<boolean> }) {
  const [editing, setEditing] = useState<Partial<SiteContent['announcements'][number]> | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const item = { id: editing?.id ?? crypto.randomUUID(), title: String(fd.get('title')).trim(), body: String(fd.get('body')).trim(), link: String(fd.get('link')).trim() || undefined, linkLabel: String(fd.get('linkLabel')).trim() || undefined, publishedAt: String(fd.get('publishedAt')) || new Date().toISOString().slice(0, 10), showOnHome: fd.get('showOnHome') === 'on' };
    setBusy(true);
    const next = editing?.id ? value.map((a) => (a.id === editing.id ? item : a)) : [item, ...value];
    if (await onSave(next)) setEditing(null);
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader title="Announcements" description="Shown on the homepage banner and the Resources page." action={<Button size="sm" onClick={() => setEditing({ showOnHome: true, publishedAt: new Date().toISOString().slice(0, 10) })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>New</Button>} />
      {value.length === 0 ? (
        <EmptyState compact title="No announcements" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {value.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-ink-900">
                  {a.title} {a.showOnHome && <Badge size="sm" tone="brand">Homepage</Badge>}
                </p>
                <p className="text-sm text-ink-600">{a.body}</p>
                <p className="text-xs text-ink-500">{a.publishedAt}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label="Edit">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => window.confirm('Delete this announcement?') && onSave(value.filter((x) => x.id !== a.id))}>
                  <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit announcement' : 'New announcement'}>
        <form onSubmit={submit} className="space-y-4">
          <Input name="title" label="Title" required defaultValue={editing?.title ?? ''} data-autofocus />
          <Textarea name="body" label="Text" required rows={3} defaultValue={editing?.body ?? ''} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="link" label="Link" optionalLabel defaultValue={editing?.link ?? ''} placeholder="/online-learning" />
            <Input name="linkLabel" label="Link label" optionalLabel defaultValue={editing?.linkLabel ?? ''} />
          </div>
          <Input name="publishedAt" type="date" label="Date" defaultValue={editing?.publishedAt ?? ''} />
          <Checkbox name="showOnHome" label="Show on homepage" defaultChecked={editing?.showOnHome ?? true} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Publish
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function HeroEditor({ value, overridden, onSave }: { value: SiteContent['hero']; overridden: boolean; onSave: (v: SiteContent['hero']) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader title="Homepage hero" action={overridden ? <Badge tone="success">Customised</Badge> : <Badge>Defaults</Badge>} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          await onSave({ ...value, eyebrow: String(fd.get('eyebrow')), headline: String(fd.get('headline')), headlineAccent: String(fd.get('headlineAccent')), subheadline: String(fd.get('subheadline')), primaryCta: { label: String(fd.get('p_label')), to: String(fd.get('p_to')) }, secondaryCta: { label: String(fd.get('s_label')), to: String(fd.get('s_to')) }, image: String(fd.get('image')), imageAlt: String(fd.get('imageAlt')) });
          setBusy(false);
        }}
        className="space-y-4"
      >
        <Input name="eyebrow" label="Eyebrow" defaultValue={value.eyebrow} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="headline" label="Headline" defaultValue={value.headline} required />
          <Input name="headlineAccent" label="Headline (accent line)" defaultValue={value.headlineAccent} required />
        </div>
        <Textarea name="subheadline" label="Sub-headline" rows={3} defaultValue={value.subheadline} required />
        <div className="grid gap-4 sm:grid-cols-4">
          <Input name="p_label" label="Primary button" defaultValue={value.primaryCta.label} />
          <Input name="p_to" label="Primary link" defaultValue={value.primaryCta.to} />
          <Input name="s_label" label="Secondary button" defaultValue={value.secondaryCta.label} />
          <Input name="s_to" label="Secondary link" defaultValue={value.secondaryCta.to} />
        </div>
        <Input name="image" label="Hero image path" defaultValue={value.image} hint="A path under /media/gallery/… (see Gallery for available photos)." />
        <Textarea name="imageAlt" label="Image alt text (accessibility)" rows={2} defaultValue={value.imageAlt} required />
        <Button type="submit" loading={busy}>
          Publish hero
        </Button>
      </form>
    </Card>
  );
}

function EventsEditor() {
  const toast = useToast();
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ['admin-events'], queryFn: listAllEvents });
  const [editing, setEditing] = useState<Partial<EventRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const toLocal = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const ends = String(fd.get('ends_at'));
      await saveEvent({ id: editing?.id, title: String(fd.get('title')).trim(), description: String(fd.get('description')).trim() || null, starts_at: new Date(String(fd.get('starts_at'))).toISOString(), ends_at: ends ? new Date(ends).toISOString() : null, location: String(fd.get('location')).trim() || null, is_online: fd.get('is_online') === 'on', registration_url: String(fd.get('registration_url')).trim() || null, is_published: fd.get('is_published') === 'on' });
      await Promise.all([events.refetch(), qc.invalidateQueries({ queryKey: ['public-events'] })]);
      setEditing(null);
      toast.success('Event saved');
    } catch (err) {
      toast.error('Failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Events" description="Published events appear on the public Events page." action={<Button size="sm" onClick={() => setEditing({ is_published: true })} leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>New event</Button>} />
      {events.isLoading ? (
        <Skeleton lines={3} />
      ) : (events.data ?? []).length === 0 ? (
        <EmptyState compact icon={<CalendarDays className="h-5 w-5" />} title="No events yet" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {(events.data ?? []).map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium text-ink-900">
                  {ev.title} {ev.is_published ? <Badge tone="success" size="sm">Published</Badge> : <Badge size="sm">Draft</Badge>}
                </p>
                <p className="text-xs text-ink-500">
                  {formatDateTime(ev.starts_at)} · {ev.is_online ? 'Online' : ev.location ?? '—'}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(ev)} aria-label="Edit">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => { if (!window.confirm('Delete this event?')) return; try { await deleteEvent(ev.id); await events.refetch(); } catch (err) { toast.error('Failed', friendlyError(err)); } }}>
                  <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit event' : 'New event'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <Input name="title" label="Title" required defaultValue={editing?.title ?? ''} data-autofocus />
          <Textarea name="description" label="Description" optionalLabel rows={3} defaultValue={editing?.description ?? ''} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="starts_at" type="datetime-local" label="Starts" required defaultValue={toLocal(editing?.starts_at)} />
            <Input name="ends_at" type="datetime-local" label="Ends" optionalLabel defaultValue={toLocal(editing?.ends_at)} />
            <Input name="location" label="Location" optionalLabel defaultValue={editing?.location ?? ''} />
            <Input name="registration_url" label="Registration link" optionalLabel defaultValue={editing?.registration_url ?? ''} />
          </div>
          <div className="flex gap-6">
            <Checkbox name="is_online" label="Online event" defaultChecked={editing?.is_online ?? false} />
            <Checkbox name="is_published" label="Published" defaultChecked={editing?.is_published ?? true} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function JsonEditor({ content, overridden, onSave }: { content: SiteContent; overridden: Set<string>; onSave: <K extends ContentKey>(key: K, value: SiteContent[K]) => Promise<boolean> }) {
  const keys = Object.keys(contentSchemas) as ContentKey[];
  const [key, setKey] = useState<ContentKey>('organisation');
  const [text, setText] = useState(() => JSON.stringify(content[key], null, 2));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(JSON.stringify(content[key], null, 2)), [key, content]);
  return (
    <Card>
      <CardHeader title="All content (advanced)" description="Every public content block as JSON, validated against its schema before publishing. Use this for programmes, stories, team, donation details, shop, FAQ and gallery captions." />
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => (
          <Button key={k} size="sm" variant={key === k ? 'secondary' : 'ghost'} onClick={() => setKey(k)}>
            {k} {overridden.has(k) ? '•' : ''}
          </Button>
        ))}
      </div>
      <Textarea label={`site_content.${key}`} value={text} onChange={(e) => setText(e.target.value)} rows={22} className="font-mono text-xs" wrapperClassName="mt-4" />
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          loading={busy}
          onClick={async () => {
            setError('');
            let parsed: unknown;
            try {
              parsed = JSON.parse(text);
            } catch (e) {
              return setError(`Invalid JSON: ${(e as Error).message}`);
            }
            const v = contentSchemas[key].safeParse(parsed);
            if (!v.success) return setError(v.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).slice(0, 5).join(' · '));
            setBusy(true);
            await onSave(key, v.data as SiteContent[typeof key]);
            setBusy(false);
          }}
        >
          Validate & publish
        </Button>
        <Button variant="outline" onClick={() => setText(JSON.stringify(defaultContent[key], null, 2))}>
          Load built-in defaults
        </Button>
        <span className="flex items-center gap-1 text-xs text-ink-500">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Changes go live immediately on the public website.
        </span>
      </div>
    </Card>
  );
}
