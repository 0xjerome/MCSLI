import { Link, Outlet } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { useSiteContent } from '@/content/useSiteContent';

export default function AuthLayout() {
  const { content } = useSiteContent();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div className="flex flex-col">
        <header className="container-x flex h-16 items-center">
          <Link to="/" className="flex items-center gap-2.5" aria-label="MCSLI home">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold text-ink-900">MCSLI</span>
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
        <footer className="container-x py-6 text-xs text-ink-500">
          © {new Date().getFullYear()} {content.organisation.name} ·{' '}
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </footer>
      </div>
      <aside className="relative hidden lg:block" aria-hidden="true">
        <img src="/media/gallery/interactive-training.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/20 to-transparent" />
        <blockquote className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-display text-2xl font-semibold leading-snug">“{content.organisation.slogan}”</p>
          <p className="mt-2 text-sm text-ink-200">{content.organisation.name}</p>
        </blockquote>
      </aside>
    </div>
  );
}
