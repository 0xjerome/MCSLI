import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { usePageMeta } from '@/lib/seo';
import { useGallery, type GalleryImage } from '@/content/useSiteContent';
import { Section, PageHero, CtaBand } from '@/components/public/Sections';
import { Tabs } from '@/components/ui/Tabs';
import { IconButton } from '@/components/ui/Button';

const categories = [
  { id: 'all', label: 'All photos' },
  { id: 'training', label: 'Training sessions' },
  { id: 'online', label: 'Online classes' },
  { id: 'community', label: 'Community & graduations' },
  { id: 'advocacy', label: 'Advocacy' },
] as const;
type Cat = (typeof categories)[number]['id'];

function monthLabel(d: string) {
  const [y, m] = d.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function GalleryPage() {
  const gallery = useGallery();
  const [cat, setCat] = useState<Cat>('all');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  usePageMeta({ title: 'Gallery', description: 'Photos from MCSLI sign language training sessions, online classes, graduations and community events across Uganda.', path: '/gallery' });

  const items = useMemo(() => (cat === 'all' ? gallery : gallery.filter((g) => g.category === cat)), [gallery, cat]);
  const current: GalleryImage | null = openIdx === null ? null : items[openIdx] ?? null;

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null);
      if (e.key === 'ArrowRight') setOpenIdx((i) => (i === null ? null : (i + 1) % items.length));
      if (e.key === 'ArrowLeft') setOpenIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length));
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIdx, items.length]);

  return (
    <>
      <PageHero eyebrow="Gallery" title="Our journey in pictures" description="From classroom and outdoor training sessions to online cohorts, graduations and community outreach — every photo is from MCSLI's own activities." />
      <Section>
        <Tabs aria-label="Photo categories" variant="pills" className="w-fit max-w-full" value={cat} onChange={setCat} tabs={categories.map((c) => ({ id: c.id, label: c.label, count: c.id === 'all' ? gallery.length : gallery.filter((g) => g.category === c.id).length }))} />
        <ul className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid">
          {items.map((g, i) => (
            <li key={g.slug}>
              <button type="button" onClick={() => setOpenIdx(i)} className="group block w-full overflow-hidden rounded-2xl bg-ink-100 text-left focus-visible:outline-brand-500" aria-label={`Open photo: ${g.title}`}>
                <img src={g.src} alt={g.alt} loading="lazy" width={g.width} height={g.height} className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                <span className="block bg-white px-4 py-3">
                  <span className="block text-sm font-semibold text-ink-900">{g.title}</span>
                  <span className="block text-xs text-ink-500">{monthLabel(g.date)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {current &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-950/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={current.title}>
            <IconButton label="Close" onClick={() => setOpenIdx(null)} className="absolute right-3 top-3 bg-white/10 text-white hover:bg-white/20" data-autofocus>
              <X className="h-6 w-6" aria-hidden="true" />
            </IconButton>
            <IconButton label="Previous photo" onClick={() => setOpenIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20">
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </IconButton>
            <IconButton label="Next photo" onClick={() => setOpenIdx((i) => (i === null ? null : (i + 1) % items.length))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20">
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </IconButton>
            <figure className="max-h-full max-w-5xl">
              <img src={current.src} alt={current.alt} className="max-h-[80vh] w-auto rounded-xl object-contain" />
              <figcaption className="mt-3 text-center text-sm text-ink-200">
                {current.alt} · {monthLabel(current.date)}
              </figcaption>
            </figure>
          </div>,
          document.body,
        )}

      <CtaBand />
    </>
  );
}
