import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';

export default function VerifyEmailPage() {
  usePageMeta({ title: 'Verify your e-mail', noIndex: true });
  return (
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <MailCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-display-sm">Verify your e-mail address</h1>
      <p className="mt-3 text-ink-600">We sent you a verification link. Open it to activate your account, then log in.</p>
      <Link to="/login" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
        Go to log in
      </Link>
    </div>
  );
}
