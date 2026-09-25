import { usePageMeta } from '@/lib/seo';
import { useSiteContent } from '@/content/useSiteContent';
import { Section, PageHero } from '@/components/public/Sections';

export default function PrivacyPage() {
  const { content } = useSiteContent();
  const { contact, organisation } = content;
  usePageMeta({ title: 'Privacy & data protection', description: 'How MCSLI handles personal data on its website and learning platform.', path: '/privacy' });
  return (
    <>
      <PageHero eyebrow="Privacy" title="How we handle your data" description="MCSLI collects only what is needed to run its programmes and the online learning platform." />
      <Section>
        <div className="prose-mcsli mx-auto max-w-prose text-[15px]">
          <h2 className="text-xl font-semibold">What we collect</h2>
          <p>
            When you register on the learning platform we store your name, e-mail address, phone number, nationality classification (used only to determine tuition), country and city. To issue a certificate in your legal name and to verify who is being assessed, we ask for a National ID (NIN) or passport number and a photo or scan of the document.
          </p>
          <h2 className="mt-8 text-xl font-semibold">How identification data is protected</h2>
          <p>
            Identification numbers are stored in a restricted table that the application cannot read directly; the app only ever shows a masked value (for example ••••••••••1234). Document files are stored in private storage, are never available at a public link, and can only be opened by authorised MCSLI administrators through time-limited links. Every time an administrator reveals a full number or opens a document, the access is recorded in an audit log.
          </p>
          <h2 className="mt-8 text-xl font-semibold">Payments</h2>
          <p>
            MCSLI does not process card payments on this website. You pay through your bank, MTN Mobile Money or Airtel Money and tell us the transaction reference; we record the reference, amount, payer name and date, and an optional receipt image you choose to upload.
          </p>
          <h2 className="mt-8 text-xl font-semibold">Practice camera</h2>
          <p>The optional practice camera runs entirely on your device. Nothing is recorded or uploaded unless you deliberately submit a file for an assessment.</p>
          <h2 className="mt-8 text-xl font-semibold">Retention and your rights</h2>
          <p>
            You can ask MCSLI to correct or delete your personal data, including identification documents, by contacting {contact.email} or {contact.phone}. Identification documents are deleted after the retention period set by MCSLI once verification is complete, unless you ask for earlier deletion.
          </p>
          <h2 className="mt-8 text-xl font-semibold">Contact</h2>
          <p>
            {organisation.name}, {contact.address}. Registration no. {organisation.registrationNumber}.
          </p>
        </div>
      </Section>
    </>
  );
}
