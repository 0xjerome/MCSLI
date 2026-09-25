import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero } from '@/components/public/Sections';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Misc';

export default function ShopPage() {
  const { content } = useSiteContent();
  const { shop, contact } = content;
  usePageMeta({ title: 'Shop', description: shop.intro, path: '/shop' });
  return (
    <>
      <PageHero eyebrow="Support our mission" title="MCSLI merchandise" description={shop.intro} />
      <Section>
        <SectionHeader title="Ugandan Sign Language collection" description={shop.note} />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shop.products.map((p) => (
            <li key={p.id} className="card flex flex-col overflow-hidden p-0">
              <div className="aspect-[4/5] bg-ink-100">
                <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" width={800} height={1000} />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold text-ink-900">{p.name}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-600">{p.description}</p>
                <p className="mt-3 font-display text-lg font-bold text-brand-700">{p.price}</p>
                <p className="mt-1 text-xs text-ink-500">Sizes: {p.sizes.join(' · ')}</p>
                <ButtonLink to={`/contact?topic=other&item=${encodeURIComponent(p.name)}`} variant="outline" size="sm" className="mt-4">
                  Order by message
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-ink-600">
          Or WhatsApp {contact.phone} with the item name, size and quantity. 100% of proceeds fund MCSLI programmes.
        </p>
      </Section>
    </>
  );
}
