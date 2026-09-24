import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight } from 'lucide-react';
import { useSiteContent } from '@/content/useSiteContent';
import { formatDate } from '@/lib/utils';

/** Admin-managed homepage announcements (site_content.announcements). Renders nothing when empty. */
export function Announcements() {
  const { content } = useSiteContent();
  const items = content.announcements.filter((a) => a.showOnHome).slice(0, 2);
  if (!items.length) return null;
  return (
    <section aria-label="Announcements" className="border-y border-accent-100 bg-accent-50">
      <div className="container-x divide-y divide-accent-100">
        {items.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-accent-700">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              {a.title}
            </span>
            <p className="flex-1 text-sm text-ink-700">{a.body}</p>
            <span className="text-xs text-ink-500">{formatDate(a.publishedAt)}</span>
            {a.link && (
              <Link to={a.link} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                {a.linkLabel ?? 'Learn more'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
