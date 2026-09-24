import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error) ? error.statusText : (error as Error)?.message;
  if (import.meta.env.DEV) console.error(error);
  return (
    <main className="container-x flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <p className="eyebrow">{is404 ? 'Page not found' : 'Something went wrong'}</p>
      <h1 className="mt-3 text-display-sm">{is404 ? "We couldn't find that page" : 'This page failed to load'}</h1>
      <p className="mt-3 max-w-md text-ink-600">
        {is404 ? 'The link may be out of date. Use the navigation to find what you need.' : 'Please refresh the page. If it keeps happening, let MCSLI know.'}
      </p>
      {!is404 && import.meta.env.DEV && message && <pre className="mt-4 max-w-full overflow-auto rounded-lg bg-ink-100 p-3 text-left text-xs text-ink-700">{message}</pre>}
      <div className="mt-6 flex gap-3">
        <ButtonLink to="/">Go to homepage</ButtonLink>
        <Link to="/contact" className="inline-flex items-center px-4 text-sm font-semibold text-brand-700 hover:underline">
          Contact MCSLI
        </Link>
      </div>
    </main>
  );
}
