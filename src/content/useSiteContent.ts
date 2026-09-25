import { useQuery } from '@tanstack/react-query';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { contentSchemas, type ContentKey, type SiteContent } from './schema';
import { defaultContent } from './defaults';
import manifest from '../../public/media/manifest.json';

export interface GalleryImage {
  slug: string;
  src: string;
  title: string;
  alt: string;
  category: string;
  date: string;
  width: number;
  height: number;
}

export const mediaManifest = manifest as { gallery: GalleryImage[]; team: Record<string, string>; stories: Record<string, string>; shop: string[] };

/** Merge database overrides over typed defaults, validating each key. Invalid rows fall back to defaults. */
export function mergeContent(rows: { key: string; value: unknown }[] | null | undefined): SiteContent {
  const out: SiteContent = { ...defaultContent };
  for (const row of rows ?? []) {
    const key = row.key as ContentKey;
    const schema = contentSchemas[key];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) {
      (out as Record<string, unknown>)[key] = parsed.data;
    } else if (import.meta.env.DEV) {
      console.warn(`site_content.${key} failed validation; using defaults`, parsed.error.flatten());
    }
  }
  return out;
}

async function fetchContent(): Promise<SiteContent> {
  if (!isSupabaseConfigured) return defaultContent;
  try {
    const { data, error } = await getSupabase().from('site_content_public').select('key, value');
    if (error) throw error;
    return mergeContent(data as { key: string; value: unknown }[]);
  } catch {
    // The public website must never break because the database is unreachable.
    return defaultContent;
  }
}

export function useSiteContent(): { content: SiteContent; isLoading: boolean } {
  const q = useQuery({ queryKey: ['site-content'], queryFn: fetchContent, staleTime: 5 * 60_000, placeholderData: defaultContent });
  return { content: q.data ?? defaultContent, isLoading: q.isLoading };
}

export function useGallery(): GalleryImage[] {
  const { content } = useSiteContent();
  const { hidden, captions } = content.gallery_overrides;
  return mediaManifest.gallery.filter((g) => !hidden.includes(g.slug)).map((g) => (captions[g.slug] ? { ...g, alt: captions[g.slug]!, title: captions[g.slug]! } : g));
}
