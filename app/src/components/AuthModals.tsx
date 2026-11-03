import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { KeyRound, LogIn, UserPlus } from 'lucide-react';
import { Modal, SubmitButton } from './Modal';
import { useApp } from '../state/store';

type Dialog = 'login' | 'signup' | 'password' | null;

interface AuthDialogsValue {
  openLogin: () => void;
  openSignup: () => void;
  openPassword: () => void;
  close: () => void;
}

const AuthDialogsContext = createContext<AuthDialogsValue | null>(null);

export function AuthDialogsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog>(null);

  const value = useMemo<AuthDialogsValue>(
    () => ({
      openLogin: () => setDialog('login'),
      openSignup: () => setDialog('signup'),
      openPassword: () => setDialog('password'),
      close: () => setDialog(null),
    }),
    [],
  );

  return (
    <AuthDialogsContext.Provider value={value}>
      {children}
      {dialog === 'login' && <LoginDialog onSwitch={() => setDialog('signup')} onClose={value.close} />}
      {dialog === 'signup' && <SignupDialog onSwitch={() => setDialog('login')} onClose={value.close} />}
      {dialog === 'password' && <PasswordDialog onClose={value.close} />}
    </AuthDialogsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthDialogs(): AuthDialogsValue {
  const context = useContext(AuthDialogsContext);
  if (!context) throw new Error('useAuthDialogs must be used inside <AuthDialogsProvider>');
  return context;
}

function LoginDialog({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signIn, cloudReady } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!username.trim() || !password) {
        setError('Enter both your username and access code');
        return;
      }
      setBusy(true);
      setError('');
      const ok = await signIn(username, password);
      setBusy(false);
      if (ok) onClose();
    },
    [onClose, password, signIn, username],
  );

  return (
    <Modal title="Admin Login" icon={<LogIn size={18} />} onClose={onClose} narrow>
      {!cloudReady && <p className="modal-note">Cloud is unreachable right now — you can still use the app offline with local data.</p>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your cloud username"
            autoComplete="username"
            autoCapitalize="none"
          />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password (access code)</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your cloud access code"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ marginTop: 18 }}>
          <SubmitButton busy={busy} busyLabel="Signing in…" label="Login" icon={<LogIn size={17} />} />
        </div>
      </form>
      <div className="modal-footer-link">
        Don&apos;t have an account?{' '}
        <button type="button" onClick={onSwitch}>
          Create one
        </button>
      </div>
    </Modal>
  );
}

function SignupDialog({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const { signUp } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError('');
    const ok = await signUp(username, password, confirm);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Create Account" icon={<UserPlus size={18} />} onClose={onClose} narrow>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
            autoCapitalize="none"
          />
        </div>
        <div className="form-group">
          <label htmlFor="signup-password">Access code (password)</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 4 characters"
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label htmlFor="signup-confirm">Confirm access code</label>
          <input
            id="signup-confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repeat your access code"
            autoComplete="new-password"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ marginTop: 18 }}>
          <SubmitButton busy={busy} busyLabel="Creating…" label="Create Account" icon={<UserPlus size={17} />} />
        </div>
      </form>
      <div className="modal-footer-link">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch}>
          Login
        </button>
      </div>
    </Modal>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const { changePassword } = useApp();
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newCode !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setBusy(true);
    setError('');
    const ok = await changePassword(oldCode, newCode, confirm);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Change Password" icon={<KeyRound size={18} />} onClose={onClose} narrow>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="pw-old">Current access code</label>
          <input
            id="pw-old"
            type="password"
            value={oldCode}
            onChange={(event) => setOldCode(event.target.value)}
            autoComplete="current-password"
            placeholder="Enter current access code"
          />
        </div>
        <div className="form-group">
          <label htmlFor="pw-new">New access code</label>
          <input
            id="pw-new"
            type="password"
            value={newCode}
            onChange={(event) => setNewCode(event.target.value)}
            autoComplete="new-password"
            placeholder="At least 4 characters"
          />
        </div>
        <div className="form-group">
          <label htmlFor="pw-confirm">Confirm new access code</label>
          <input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat the new access code"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ marginTop: 18 }}>
          <SubmitButton busy={busy} busyLabel="Saving…" label="Update Password" icon={<KeyRound size={17} />} />
        </div>
      </form>
    </Modal>
  );
}
