import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, MapPin, Phone, Mail, Facebook, Instagram, Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSiteContent } from '@/content/useSiteContent';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeRouteFor } from '@/domain/roles';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Programs', to: '/programs' },
  { label: 'Online Learning', to: '/online-learning' },
  { label: 'Impact', to: '/impact' },
  { label: 'Events', to: '/events' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Resources', to: '/resources' },
  { label: 'Contact', to: '/contact' },
];

function XIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.53 3h3.03l-6.62 7.57L21.7 21h-6.1l-4.78-6.25L5.35 21H2.32l7.08-8.1L1.94 3h6.26l4.32 5.71L17.53 3Zm-1.06 16.2h1.68L6.44 4.7H4.64l11.83 14.5Z" />
    </svg>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { session, role } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const authed = Boolean(session && role);
  const appHome = homeRouteFor(role);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="MCSLI home">
          <Logo className="h-9 w-9" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight text-ink-900">MCSLI</span>
            <span className="hidden text-[11px] text-ink-500 sm:block">Master Class Sign Language Initiative</span>
          </span>
        </Link>

        <nav className="hidden xl:block" aria-label="Main">
          <ul className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900')
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {authed ? (
            <ButtonLink to={appHome} variant="primary" size="sm" className="hidden sm:inline-flex">
              Open my dashboard
            </ButtonLink>
          ) : (
            <>
              <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 sm:inline-block">
                Log in
              </Link>
              <ButtonLink to="/register" variant="accent" size="sm" rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                Start Learning
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden" role="presentation">
          <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="mobile-menu"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col bg-white shadow-overlay animate-slide-in-right"
          >
            <div className="flex h-16 items-center justify-between border-b border-ink-200 px-4">
              <span className="font-display text-base font-bold">Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-ink-100" aria-label="Close menu">
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">
              <ul className="space-y-0.5">
                {NAV.map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.to === '/'}
                      className={({ isActive }) =>
                        cn('flex items-center rounded-xl px-3 py-3 text-base font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-800 hover:bg-ink-100')
                      }
                    >
                      {n.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="space-y-2 border-t border-ink-200 p-4 safe-bottom">
              {authed ? (
                <ButtonLink to={appHome} className="w-full">
                  Open my dashboard
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to="/register" variant="accent" className="w-full">
                    Start Learning
                  </ButtonLink>
                  <ButtonLink to="/login" variant="outline" className="w-full">
                    Log in
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { content } = useSiteContent();
  const { organisation: org, contact } = content;
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ink-200 bg-ink-950 text-ink-300">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10 rounded-lg" />
              <div>
                <p className="font-display text-lg font-bold text-white">{org.shortName}</p>
                <p className="text-sm text-ink-400">{org.slogan}</p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed">{org.intro}</p>
            <p className="mt-4 text-sm font-medium text-accent-300">“{org.tagline}”</p>
            <ul className="mt-6 flex gap-3" aria-label="Social media">
              {contact.social.facebook && (
                <li>
                  <a href={contact.social.facebook} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10" aria-label="MCSLI on Facebook">
                    <Facebook className="h-5 w-5" aria-hidden="true" />
                  </a>
                </li>
              )}
              {contact.social.x && (
                <li>
                  <a href={contact.social.x} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10" aria-label="MCSLI on X">
                    <XIcon className="h-4 w-4" />
                  </a>
                </li>
              )}
              {contact.social.instagram && (
                <li>
                  <a href={contact.social.instagram} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10" aria-label="MCSLI on Instagram">
                    <Instagram className="h-5 w-5" aria-hidden="true" />
                  </a>
                </li>
              )}
              {contact.social.linkedin && (
                <li>
                  <a href={contact.social.linkedin} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10" aria-label="MCSLI on LinkedIn">
                    <Linkedin className="h-5 w-5" aria-hidden="true" />
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Explore</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ['About MCSLI', '/about'],
                ['Programs', '/programs'],
                ['Online learning', '/online-learning'],
                ['Impact stories', '/impact'],
                ['Gallery', '/gallery'],
                ['Shop', '/shop'],
              ].map(([l, to]) => (
                <li key={to}>
                  <Link to={to!} className="hover:text-white hover:underline">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Get involved</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ['Start learning', '/register'],
                ['Log in', '/login'],
                ['Donate', '/donate'],
                ['Volunteer', '/contact?topic=volunteer'],
                ['Partner with us', '/contact?topic=partnership'],
                ['Verify a certificate', '/certificate'],
              ].map(([l, to]) => (
                <li key={to}>
                  <Link to={to!} className="hover:text-white hover:underline">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Contact</h2>
            <address className="mt-4 space-y-3 text-sm not-italic">
              <p className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                <span>{contact.address}</span>
              </p>
              <p className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                <a href={`tel:${contact.phoneIntl}`} className="hover:text-white">
                  {contact.phone}
                </a>
              </p>
              <p className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                <a href={`mailto:${contact.email}`} className="hover:text-white">
                  {contact.email}
                </a>
              </p>
            </address>
            <dl className="mt-4 text-sm">
              {contact.hours.slice(0, 2).map((h) => (
                <div key={h.days} className="flex justify-between gap-4">
                  <dt className="text-ink-400">{h.days}</dt>
                  <dd>{h.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {org.name} ({org.shortName}). All rights reserved.
          </p>
          <p>
            {org.registrar} registration no. {org.registrationNumber} ·{' '}
            <Link to="/privacy" className="hover:text-white hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <PublicHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
