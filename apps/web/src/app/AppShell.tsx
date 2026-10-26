import { Link, Outlet, useRouterState } from '@tanstack/react-router';

const links = [
  { to: '/', label: 'Ramp' },
  { to: '/history', label: 'Change log' },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <header className="app-header">
        <div>
          <div className="brand">Campaign ramp-up</div>
          <div className="brand-sub">Sponsored Products · local apply</div>
        </div>
        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              search={link.to === '/history' ? {} : undefined}
              className={pathname === link.to ? 'active' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </>
  );
}
