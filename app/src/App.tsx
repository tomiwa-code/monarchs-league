import { useEffect } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { AppProvider, useApp } from './state/store';
import { AuthDialogsProvider } from './components/AuthModals';
import { Navbar } from './components/Navbar';
import { ToastHost } from './components/ToastHost';
import { HomePage } from './pages/HomePage';
import { CreatePage } from './pages/CreatePage';
import { LeaguesPage } from './pages/LeaguesPage';
import { LeagueDetailPage } from './pages/LeagueDetailPage';
import { navigate, useRoute } from './lib/router';
import { usePwa } from './hooks/usePwa';
import { ShieldMark } from './components/Brand';

function Shell() {
  const route = useRoute();
  const pwa = usePwa();
  const { isAdmin, getLeague, notify } = useApp();

  // Direct links to unknown leagues fall back to the list.
  useEffect(() => {
    if (route.name === 'league' && !getLeague(route.id)) {
      navigate({ name: 'leagues' }, { replace: true });
    }
  }, [route, getLeague]);

  // Creating a league is an admin-only screen.
  useEffect(() => {
    if (route.name === 'create' && !isAdmin) {
      notify('Log in as an admin to create leagues', 'error');
      navigate({ name: 'home' }, { replace: true });
    }
  }, [route, isAdmin, notify]);

  const activeLeague = route.name === 'league' ? getLeague(route.id) : undefined;

  return (
    <>
      {pwa.offline && (
        <div className="offline-bar" role="status">
          <CloudOff size={15} /> You&apos;re offline — changes are saved on this device and sync when you reconnect.
        </div>
      )}
      {pwa.updateReady && (
        <div className="update-bar" role="status">
          <RefreshCw size={15} /> A new version of League Arena is ready.
          <button type="button" onClick={() => void pwa.applyUpdate()}>
            Reload
          </button>
          <button type="button" onClick={pwa.dismissUpdate}>
            Later
          </button>
        </div>
      )}

      <Navbar
        pwa={pwa}
        onHome={() => {
          navigate({ name: 'home' });
          // Leaving a league view should also reset lazy UI state cleanly.
        }}
      />

      <main className="container">
        {route.name === 'home' && (
          <HomePage
            pwa={pwa}
            onCreate={() => navigate({ name: 'create' })}
            onLeagues={() => navigate({ name: 'leagues' })}
            onOpenLeague={(id) => navigate({ name: 'league', id })}
          />
        )}

        {route.name === 'create' && (
          <CreatePage
            onBack={() => navigate({ name: 'home' })}
            onCreated={(id) => navigate({ name: 'league', id })}
          />
        )}

        {route.name === 'leagues' && (
          <LeaguesPage
            sharedUser={route.user}
            onBack={() => navigate({ name: 'home' })}
            onCreate={() => navigate({ name: 'create' })}
            onOpen={(id) => navigate({ name: 'league', id })}
          />
        )}

        {route.name === 'league' && activeLeague && (
          <LeagueDetailPage
            key={activeLeague.id}
            league={activeLeague}
            onBack={() => navigate({ name: 'leagues' })}
          />
        )}

        <footer className="app-footer">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldMark size={14} /> League Arena · a clean league manager
          </span>
          <span>Works offline · installable · your data stays yours</span>
        </footer>
      </main>

      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthDialogsProvider>
        <Shell />
      </AuthDialogsProvider>
    </AppProvider>
  );
}
