import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  ApiRequestError,
  loadApiState,
  setServerUrl,
  setToken,
  getToken,
} from '../api/client';
import type { SessionUser } from '../api/types';
import { stopTracking } from '../tracking/locationTask';

interface SessionContextValue {
  user: SessionUser | null;
  initializing: boolean;
  signIn: (serverUrl: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface GetSessionResponse {
  session: { id: string } | null;
  user: SessionUser | null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const data = await api<GetSessionResponse | null>('/api/auth/get-session');
      setUser(data?.user ?? null);
      if (!data?.user) await setToken(null);
    } catch (err) {
      // Token kedaluwarsa/dicabut → paksa login ulang; error jaringan → biarkan
      if (err instanceof ApiRequestError && err.status === 401) {
        await setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadApiState();
      await refresh();
      setInitializing(false);
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (serverUrl: string, email: string, password: string) => {
      await setServerUrl(serverUrl);
      await setToken(null);

      const res = await api<{ token?: string; user?: SessionUser }>(
        '/api/auth/sign-in/email',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );

      // Token dari header set-auth-token sudah disimpan oleh api();
      // fallback: sebagian versi Better Auth juga menaruhnya di body.
      if (!getToken() && res.token) {
        await setToken(res.token);
      }
      if (!getToken()) {
        throw new ApiRequestError(
          'Login berhasil tapi token tidak diterima — pastikan server versi terbaru.',
          500
        );
      }
      await refresh();
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    await stopTracking().catch(() => undefined);
    await api('/api/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined);
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, initializing, signIn, signOut, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession harus dipakai di dalam SessionProvider');
  return ctx;
}
