import { z } from 'zod';

/**
 * Schemas for admin-managed public website content (site_content table).
 * Defaults live in ./defaults.ts; admins edit values in /admin/content.
 */

export const contactSchema = z.object({
  address: z.string(),
  addressShort: z.string(),
  phone: z.string(),
  phoneIntl: z.string(),
  whatsapp: z.string().optional(),
  email: z.string().email(),
  website: z.string(),
  hours: z.array(z.object({ days: z.string(), hours: z.string() })),
  social: z.object({
    facebook: z.string().url().optional(),
    x: z.string().url().optional(),
    instagram: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    youtube: z.string().url().optional(),
  }),
  mapQuery: z.string(),
});

export const organisationSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  slogan: z.string(),
  tagline: z.string(),
  registrationNumber: z.string(),
  registrar: z.string(),
  foundedYear: z.number(),
  registeredYear: z.number(),
  type: z.string(),
  leadership: z.string(),
  mission: z.string(),
  vision: z.string(),
  vision2040: z.object({ quote: z.string(), author: z.string(), title: z.string() }),
  coreValues: z.array(z.string()),
  intro: z.string(),
});

export const impactStatSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string().optional(),
  /** Set by MCSLI once the figure has been checked against records. Unverified stats are not shown publicly. */
  verified: z.boolean().default(false),
});
export const impactStatsSchema = z.object({
  asOf: z.string().optional(),
  stats: z.array(impactStatSchema),
});

export const heroSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  headlineAccent: z.string(),
  subheadline: z.string(),
  primaryCta: z.object({ label: z.string(), to: z.string() }),
  secondaryCta: z.object({ label: z.string(), to: z.string() }),
  image: z.string(),
  imageAlt: z.string(),
});

export const programSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  duration: z.string(),
  format: z.string(),
  icon: z.string(),
});
export const programsSchema = z.object({
  intro: z.string(),
  training: z.array(programSchema),
  schedule: z.array(z.object({ type: z.string(), days: z.string(), time: z.string(), format: z.string() })),
  certificateNote: z.string(),
  focusAreas: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string() })),
  empowerment: z.array(z.object({ title: z.string(), description: z.string(), features: z.array(z.string()) })),
});

export const storySchema = z.object({
  slug: z.string(),
  name: z.string(),
  year: z.string(),
  cohort: z.string().optional(),
  summary: z.string(),
  testimony: z.string(),
  image: z.string().optional(),
  featured: z.boolean().optional(),
});
export const storiesSchema = z.array(storySchema);

export const teamMemberSchema = z.object({
  name: z.string(),
  position: z.string(),
  image: z.string().optional(),
  bio: z.string().optional(),
});
export const teamSchema = z.object({ leadership: z.array(teamMemberSchema), members: z.array(teamMemberSchema) });

export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  link: z.string().optional(),
  linkLabel: z.string().optional(),
  publishedAt: z.string(),
  showOnHome: z.boolean().default(true),
});
export const announcementsSchema = z.array(announcementSchema);

export const donationSchema = z.object({
  intro: z.string(),
  bank: z.object({ bankName: z.string(), accountName: z.string(), accountNumber: z.string(), currency: z.string(), swift: z.string().optional(), note: z.string().optional() }).optional(),
  mobileMoney: z.array(z.object({ provider: z.string(), label: z.string(), merchantCode: z.string() })),
  inKind: z.array(z.string()),
  impactExamples: z.array(z.object({ amount: z.string(), impact: z.string() })),
  useOfFunds: z.array(z.object({ title: z.string(), description: z.string() })),
});

export const shopSchema = z.object({
  intro: z.string(),
  note: z.string(),
  products: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), price: z.string(), sizes: z.array(z.string()), image: z.string() })),
});

export const faqSchema = z.array(z.object({ category: z.string(), question: z.string(), answer: z.string() }));

export const galleryOverridesSchema = z.object({
  hidden: z.array(z.string()).default([]),
  captions: z.record(z.string(), z.string()).default({}),
});

export const contentSchemas = {
  organisation: organisationSchema,
  contact: contactSchema,
  hero: heroSchema,
  impact_stats: impactStatsSchema,
  programs: programsSchema,
  stories: storiesSchema,
  team: teamSchema,
  announcements: announcementsSchema,
  donation: donationSchema,
  shop: shopSchema,
  faq: faqSchema,
  gallery_overrides: galleryOverridesSchema,
} as const;

export type ContentKey = keyof typeof contentSchemas;
export type ContentValue<K extends ContentKey> = z.infer<(typeof contentSchemas)[K]>;
export type SiteContent = { [K in ContentKey]: ContentValue<K> };
