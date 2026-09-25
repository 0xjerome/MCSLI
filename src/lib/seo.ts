import { useEffect } from 'react';

export interface PageMeta {
  title: string;
  description?: string;
  /** Path (e.g. "/about") – converted to an absolute canonical URL. */
  path?: string;
  image?: string;
  noIndex?: boolean;
  /** JSON-LD structured data. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_NAME = 'MCSLI – Master Class Sign Language Initiative';
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://mcsli.org').replace(/\/$/, '');
const DEFAULT_DESCRIPTION = 'MCSLI is a Deaf-led organisation in Uganda promoting Ugandan Sign Language through training, advocacy, community programmes and an online learning platform.';
const DEFAULT_IMAGE = `${SITE_URL}/media/gallery/outdoor-teaching-session.jpg`;

function setMeta(attr: 'name' | 'property', key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Sets document title, description, canonical, OpenGraph/Twitter tags and JSON-LD for the current page.
 */
export function usePageMeta(meta: PageMeta) {
  const { title, description = DEFAULT_DESCRIPTION, path, image = DEFAULT_IMAGE, noIndex, jsonLd } = meta;
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const fullTitle = title.includes('MCSLI') ? title : `${title} · MCSLI`;
    document.title = fullTitle;
    const url = path ? `${SITE_URL}${path}` : `${SITE_URL}${window.location.pathname}`;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    setLink('canonical', url);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:locale', 'en_UG');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    let script = document.head.querySelector<HTMLScriptElement>('script[data-jsonld="page"]');
    if (jsonLdString) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.jsonld = 'page';
        document.head.appendChild(script);
      }
      script.textContent = jsonLdString;
    } else {
      script?.remove();
    }
  }, [title, description, path, image, noIndex, jsonLdString]);
}

export const organisationJsonLd = (contact: { address: string; phone: string; email: string; social: Record<string, string | undefined> }) => ({
  '@context': 'https://schema.org',
  '@type': 'NGO',
  name: 'Master Class Sign Language Initiative',
  alternateName: 'MCSLI',
  url: SITE_URL,
  logo: `${SITE_URL}/media/logo.jpg`,
  email: contact.email,
  telephone: contact.phone,
  address: { '@type': 'PostalAddress', streetAddress: contact.address, addressLocality: 'Kampala', addressCountry: 'UG' },
  sameAs: Object.values(contact.social).filter(Boolean),
});
