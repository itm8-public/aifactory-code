import { Link, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { MeDto } from '../shared/contracts';
import { api } from './api';
import { Logo } from './design/components';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<MeDto>('/api/me') });
}

export function Layout() {
  const me = useMe();
  return (
    <>
      <header className="itm8-header">
        <div className="itm8-container itm8-header__inner">
          <Link to="/" className="app-brand" aria-label="__TITLE__, home">
            <Logo height={32} alt="" />
            <span>__TITLE__</span>
          </Link>
          <nav className="app-nav" aria-label="Main">
            <Link to="/" activeOptions={{ exact: true }}>
              Home
            </Link>
{/* @if db */}
            <Link to="/items">Items</Link>
{/* @endif */}
{/* @if ai */}
            <Link to="/ask">Ask AI</Link>
{/* @endif */}
{/* @if agent */}
            <Link to="/assistant">Assistant</Link>
{/* @endif */}
          </nav>
          <span className="app-user">{me.data?.name || (me.isError ? 'Not signed in' : '')}</span>
        </div>
      </header>
      <main className="itm8-container app-main">
        <Outlet />
      </main>
      <footer className="itm8-container app-footer">
        <small>__TITLE__ · Built on the itm8 AI Factory</small>
      </footer>
    </>
  );
}
