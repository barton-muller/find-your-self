import { useEffect, useState } from 'react';

export type Route = { view: 'plan' | 'map' | 'timeline' | 'todo' | 'settings' } | { view: 'place'; id: string } | { view: 'join'; data: string };

const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '');
  const [v, id] = h.split('/');
  if (v === 'place' && id) return { view: 'place', id };
  if (v === 'join' && id) return { view: 'join', data: id };
  if (v === 'map' || v === 'timeline' || v === 'todo' || v === 'settings') return { view: v };
  return { view: 'plan' };
};

export const href = (r: Route) => `#/${r.view}${'id' in r ? `/${r.id}` : 'data' in r ? `/${r.data}` : ''}`;
export const go = (r: Route) => {
  location.hash = href(r);
};

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const f = () => setR(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
