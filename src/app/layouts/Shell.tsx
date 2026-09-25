import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Menu, MoreHorizontal, UserCircle2, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import { countUnread } from '@/services/community';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/ui/Misc';
import { Dropdown } from '@/components/ui/Dropdown';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  /** Show in the mobile bottom bar (max 4). */
  primary?: boolean;
}

interface ShellProps {
  items: NavItem[];
  areaLabel: string;
  areaTone?: 'student' | 'trainer' | 'admin';
  basePath: string;
  headerExtra?: ReactNode;
}

/**
 * Authenticated application shell: sidebar on desktop, bottom bar + drawer on mobile.
 * Shared by the student, trainer and admin areas with different nav items.
 */
export function Shell({ items, areaLabel, areaTone = 'student', basePath, headerExtra }: ShellProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const unread = useQuery({ queryKey: ['unread-count'], queryFn: countUnread, refetchInterval: 60_000 });

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawer]);

  const primary = items.filter((i) => i.primary).slice(0, 4);
  const toneBar = { student: 'bg-brand-600', trainer: 'bg-accent-500', admin: 'bg-ink-900' }[areaTone];

  const onSignOut = async () => {
    await signOut();
    qc.clear();
    navigate('/', { replace: true });
  };

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900');

  const NavList = () => (
    <ul className="space-y-0.5">
      {items.map((i) => (
        <li key={i.to}>
          <NavLink to={i.to} end={i.end} className={navLinkCls}>
            <i.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {i.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-screen bg-ink-50">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex" aria-label={`${areaLabel} navigation`}>
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-200 px-5">
          <Logo className="h-8 w-8" />
          <div className="leading-tight">
            <p className="font-display text-base font-bold text-ink-900">MCSLI</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{areaLabel}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <NavList />
        </nav>
        <div className="border-t border-ink-200 p-3">
          <Link to="/" className="block rounded-lg px-3 py-2 text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-800">
            ← Back to mcsli.org
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
          <div className={cn('h-1', toneBar)} aria-hidden="true" />
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <Link to={basePath} className="flex items-center gap-2" aria-label="Dashboard home">
                <Logo className="h-8 w-8" />
                <span className="font-display font-bold text-ink-900">MCSLI</span>
              </Link>
            </div>
            <div className="hidden lg:block">{headerExtra}</div>
            <div className="flex items-center gap-1">
              <Link to={`${basePath}/notifications`} className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100" aria-label={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`}>
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unread.data ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white" aria-hidden="true">
                    {unread.data > 9 ? '9+' : unread.data}
                  </span>
                ) : null}
              </Link>
              <Dropdown
                label="Account menu"
                items={[
                  { id: 'profile', label: 'My profile', icon: <UserCircle2 className="h-4 w-4" aria-hidden="true" />, onSelect: () => navigate(`${basePath}/profile`) },
                  { id: 'site', label: 'Public website', onSelect: () => navigate('/') },
                  { id: 'logout', label: 'Log out', icon: <LogOut className="h-4 w-4" aria-hidden="true" />, onSelect: onSignOut, danger: true },
                ]}
                trigger={(p) => (
                  <button type="button" {...p} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-ink-100">
                    <Avatar name={profile?.full_name} size="sm" />
                    <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink-800 sm:inline">{profile?.full_name}</span>
                    <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:inline" aria-hidden="true" />
                  </button>
                )}
              />
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100 lg:hidden" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom bar */}
      {primary.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white safe-bottom lg:hidden" aria-label="Primary">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
            {primary.map((i) => (
              <li key={i.to}>
                <NavLink to={i.to} end={i.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-ink-500')}>
                  {({ isActive }) => (
                    <>
                      <i.icon className={cn('h-5 w-5', isActive && 'text-brand-600')} aria-hidden="true" />
                      {i.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium text-ink-500" aria-label="More menu">
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                More
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={() => setDrawer(false)} aria-hidden="true" />
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu" className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-overlay animate-slide-in-right">
            <div className="flex h-14 items-center justify-between border-b border-ink-200 px-4">
              <span className="font-display font-bold">{areaLabel}</span>
              <button type="button" onClick={() => setDrawer(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-ink-100" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <NavList />
            </nav>
            <div className="border-t border-ink-200 p-3">
              <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger-700 hover:bg-danger-50">
                <LogOut className="h-5 w-5" aria-hidden="true" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-display-sm">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-600 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
