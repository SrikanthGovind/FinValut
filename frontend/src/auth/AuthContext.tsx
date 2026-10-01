import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";

import {
  LOGIN,
  ME,
  REGISTER,
} from "../graphql/operations";
import {
  SESSION_EXPIRED_EVENT,
  readToken,
  writeToken,
} from "../graphql/client";
import type { AuthPayload, User } from "../graphql/types";
import {
  ROLE_HOME,
  hasAnyPermission,
  hasPermission,
  type Capability,
  type UserRole,
} from "../rbac";
import { useSnackbar } from "../components/common/ToastProvider";

interface Credentials {
  email: string;
  password: string;
}

interface Registration extends Credentials {
  firstName: string;
  lastName?: string;
  phone?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  /** True while the stored session is being validated on first paint. */
  bootstrapping: boolean;
  login: (credentials: Credentials) => Promise<User>;
  register: (input: Registration) => Promise<User>;
  logout: () => void;
  can: (capability: Capability) => boolean;
  canAny: (capabilities: Capability[]) => boolean;
  homeFor: (roleValue: UserRole) => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const { notify } = useSnackbar();
  const [token, setToken] = useState<string | null>(() => readToken());
  /** The user handed back by a fresh login/register, used until `me` answers. */
  const [signedIn, setSignedIn] = useState<User | null>(null);

  const [loginMutation] = useMutation<{ login: AuthPayload }>(LOGIN);
  const [registerMutation] = useMutation<{ register: AuthPayload }>(REGISTER);

  const hasToken = Boolean(token);
  const { data, loading, error } = useQuery<{ me: User | null }>(ME, {
    skip: !hasToken,
    fetchPolicy: "network-only",
  });

  /**
   * A rejected token is dropped during render rather than in an effect.
   *
   * `me` answering with null, or erroring, means the stored token is dead. It
   * has to be discarded before any guarded route reads `user`, and an effect
   * would render one frame with the stale session first. Adjusting state during
   * render is React's documented alternative.
   *
   * There is no need for a "have I already cleaned this token up" flag:
   * clearing the token makes `hasToken` false, so the condition is false on the
   * re-render this triggers and cannot loop.
   */
  if (hasToken && !loading && (error || !data?.me)) {
    writeToken(null);
    setToken(null);
  }

  // `me` wins once it answers, so a role or status change made by an admin is
  // picked up on refetch rather than being masked by the login-time copy.
  const user = data?.me ?? signedIn;
  // Only the first load is a real bootstrap; a background refetch keeps the
  // previous `data` and must not blank the screen back to the splash.
  const bootstrapping = hasToken && loading && !data;

  const adoptSession = useCallback(
    (payload: AuthPayload): User => {
      writeToken(payload.accessToken);
      setToken(payload.accessToken);
      setSignedIn(payload.user);
      // The previous identity's cached records must not survive the switch.
      void client.clearStore();
      return payload.user;
    },
    [client]
  );

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setSignedIn(null);
    void client.clearStore();
  }, [client]);

  const login = useCallback(
    async (credentials: Credentials): Promise<User> => {
      const result = await loginMutation({ variables: credentials });
      const payload = result.data?.login;
      if (!payload) throw new Error("Login failed: no response");
      notify("success", `Welcome back, ${payload.user.firstName}`);
      return adoptSession(payload);
    },
    [loginMutation, adoptSession, notify]
  );

  const register = useCallback(
    async (input: Registration): Promise<User> => {
      const result = await registerMutation({ variables: input });
      const payload = result.data?.register;
      if (!payload) throw new Error("Registration failed: no response");
      notify("success", "Account created. You are signed in.");
      return adoptSession(payload);
    },
    [registerMutation, adoptSession, notify]
  );

  // The Apollo error link cannot reach React state directly, so it raises a
  // DOM event that this provider listens for.
  useEffect(() => {
    const handle = () => {
      const dead = readToken();
      if (!dead) return;
      writeToken(null);
      setToken(null);
      setSignedIn(null);
      void client.clearStore();
      notify("warning", "Your session expired. Please sign in again.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handle);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handle);
  }, [client, notify]);

  const role = (user?.role as UserRole | undefined) ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      role,
      bootstrapping,
      login,
      register,
      logout,
      can: (capability: Capability) => hasPermission(role, capability),
      canAny: (capabilities: Capability[]) => hasAnyPermission(role, capabilities),
      homeFor: (roleValue: UserRole) => ROLE_HOME[roleValue] ?? "/",
    }),
    [user, token, role, bootstrapping, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

/** Submit-state helper so login/register/manage forms do not each reinvent it. */
export function useAuthSubmitState() {
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const run = useCallback(async (task: () => Promise<unknown>) => {
    setPending(true);
    setSubmitError(null);
    try {
      await task();
      return true;
    } catch (caught) {
      setSubmitError(
        caught instanceof Error ? caught.message : "Something went wrong"
      );
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, submitError, setSubmitError, run };
}
