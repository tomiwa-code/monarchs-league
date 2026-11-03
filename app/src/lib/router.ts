import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'leagues'; user?: string }
  | { name: 'league'; id: number };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [head, param] = path.split('/');
  const params = new URLSearchParams(query);
  switch (head) {
    case 'create':
      return { name: 'create' };
    case 'leagues': {
      const user = params.get('user')?.trim();
      return user ? { name: 'leagues', user } : { name: 'leagues' };
    }
    case 'league': {
      const id = Number(param);
      return Number.isFinite(id) && id > 0 ? { name: 'league', id } : { name: 'leagues' };
    }
    default:
      return { name: 'home' };
  }
}

/** Absolute, shareable link to a league owner's cloud leagues. */
export function shareLinkFor(username?: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return username ? `${base}#/leagues?user=${encodeURIComponent(username)}` : base;
}

export const routeToHash = (route: Route): string => {
  switch (route.name) {
    case 'create':
      return '#/create';
    case 'leagues':
      return route.user ? `#/leagues?user=${encodeURIComponent(route.user)}` : '#/leagues';
    case 'league':
      return `#/league/${route.id}`;
    default:
      return '#/';
  }
};

export function navigate(route: Route, { replace = false } = {}): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) return;
  if (replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
