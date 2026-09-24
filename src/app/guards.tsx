import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasAtLeast, homeRouteFor } from '@/domain/roles';
import type { UserRole } from '@/domain/types';
import { PageLoader, PermissionDenied, Alert } from '@/components/ui/Misc';
import { ButtonLink } from '@/components/ui/Button';

/**
 * Route guard. Redirects anonymous users to /login (remembering where they were going) and
 * shows a permission-denied screen to users whose role is insufficient. This is a UX layer only:
 * the database enforces authorisation regardless of what the client renders.
 */
export function RequireAuth({ minRole, exactRoles }: { minRole?: UserRole; exactRoles?: UserRole[] }) {
  const { session, profile, loading, configured, role } = useAuth();
  const location = useLocation();

  if (!configured) return <NotConfigured />;
  if (loading) return <PageLoader label="Checking your session" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!profile) return <PageLoader label="Loading your profile" />;
  if (profile.account_status === 'suspended') {
    return (
      <div className="container-x py-16">
        <Alert tone="danger" title="Your account is suspended">
          Please contact MCSLI at info@mcsli.org or 0701806993 for assistance.
        </Alert>
      </div>
    );
  }
  const ok = exactRoles ? exactRoles.includes(role!) : minRole ? hasAtLeast(role, minRole) : true;
  if (!ok) {
    return (
      <div className="container-x py-16">
        <PermissionDenied description={`This area is for ${exactRoles?.join(' / ') ?? minRole} accounts. Your home is ${homeRouteFor(role)}.`} />
      </div>
    );
  }
  return <Outlet />;
}

/** Sends already-authenticated users away from the auth pages. */
export function RedirectIfAuthed() {
  const { session, role, loading, configured } = useAuth();
  if (!configured) return <Outlet />;
  if (loading) return <PageLoader />;
  if (session && role) return <Navigate to={homeRouteFor(role)} replace />;
  return <Outlet />;
}

export function NotConfigured() {
  return (
    <div className="container-x py-16">
      <div className="mx-auto max-w-xl">
        <Alert tone="warning" title="The learning platform is not connected yet">
          <p>
            This deployment has no Supabase project configured, so login, registration and the learning dashboard are unavailable. The
            public website works normally.
          </p>
          <p className="mt-2 text-sm">
            Developers: copy <code>.env.example</code> to <code>.env.local</code> and set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>. See the README for database setup.
          </p>
        </Alert>
        <ButtonLink to="/" variant="outline" className="mt-4">
          Back to the website
        </ButtonLink>
      </div>
    </div>
  );
}
