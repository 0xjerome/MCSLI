import { usePageMeta } from '@/lib/seo';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFoundPage() {
  usePageMeta({ title: 'Page not found', noIndex: true });
  return (
    <section className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-display-sm sm:text-display-md">We couldn't find that page</h1>
      <p className="mt-3 max-w-md text-ink-600">The link may be out of date. Try the navigation above, or go back to the homepage.</p>
      <div className="mt-6 flex gap-3">
        <ButtonLink to="/">Go to homepage</ButtonLink>
        <ButtonLink to="/contact" variant="outline">
          Contact MCSLI
        </ButtonLink>
      </div>
    </section>
  );
}
