import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Download,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  UserCog,
  UserRound,
  ChevronDown,
} from 'lucide-react';
import { Brand } from './Brand';
import { useApp } from '../state/store';
import { useAuthDialogs } from './AuthModals';
import type { PwaApi } from '../hooks/usePwa';

interface NavbarProps {
  onHome: () => void;
  pwa: PwaApi;
}

export function Navbar({ onHome, pwa }: NavbarProps) {
  const { isAdmin, session, syncState, signOut } = useApp();
  const { openLogin, openPassword } = useAuthDialogs();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const syncPill = () => {
    if (!isAdmin) return null;
    if (syncState === 'syncing') {
      return (
        <span className="sync-pill syncing" title="Syncing with the cloud">
          <Loader2 size={12} /> Syncing
        </span>
      );
    }
    if (syncState === 'synced') {
      return (
        <span className="sync-pill synced" title="Saved to the cloud">
          <CheckCircle2 size={12} /> Saved
        </span>
      );
    }
    if (syncState === 'error') {
      return (
        <span className="sync-pill error" title="Cloud sync failed — data is safe locally">
          <CloudOff size={12} /> Offline
        </span>
      );
    }
    return null;
  };

  return (
    <nav className="navbar">
      <Brand onClick={onHome} />
      <div className="navbar-actions">
        {syncPill()}
        {pwa.canInstall && (
          <button type="button" className="btn btn-secondary" onClick={() => void pwa.install()}>
            <Download size={15} /> Install
          </button>
        )}
        {isAdmin ? (
          <>
            <span className="admin-badge">
              <UserCog size={12} /> Admin
            </span>
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-toggle"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <UserRound size={16} />
                <span>{session.username}</span>
                <ChevronDown size={11} />
              </button>
              {menuOpen && (
                <div className="user-menu-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      openPassword();
                    }}
                  >
                    <KeyRound size={15} /> Change Password
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={openLogin}>
            <LogIn size={15} /> Admin
          </button>
        )}
      </div>
    </nav>
  );
}
