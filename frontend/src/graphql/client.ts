import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  Observable,
  from,
} from "@apollo/client";

export const TOKEN_STORAGE_KEY = "finvault.accessToken";
export const SESSION_EXPIRED_EVENT = "finvault:session-expired";

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* private mode, quota, or storage disabled: the in-memory session still works */
  }
}

/** Broadcast when the server rejects the stored token, so AuthProvider can log out. */
export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

const httpLink = new HttpLink({ uri: "/graphql" });

/**
 * Reads the token at request time rather than closing over it at construction,
 * so logging in or out takes effect on the very next operation without the
 * client being rebuilt.
 */
const authLink = new ApolloLink((operation, forward) => {
  const token = readToken();
  operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
    headers: token ? { ...headers, authorization: `Bearer ${token}` } : headers,
  }));
  return forward(operation);
});

/**
 * Watches every response for a rejected session and raises the event that
 * AuthProvider listens for.
 *
 * A link must *return an Observable of results*, not a Subscription. Building
 * one with `new Observable` and re-emitting from a subscription is what keeps
 * the observer contract intact: the subscriber downstream still receives
 * `next`, `error` and `complete` in order. Returning the Subscription directly
 * makes Apollo call `.subscribe` on it a second time, which throws
 * "value.subscribe is not a function" and fails every operation in the app.
 */
const errorLink = new ApolloLink((operation, forward) =>
  new Observable((observer) => {
    const subscription = forward(operation).subscribe({
      next: (result) => {
        const error = result.errors?.[0];
        if (error) {
          const message = error.message.toLowerCase();
          const isAuthFailure =
            message.includes("unauthorized") ||
            message.includes("authentication required") ||
            message.includes("access denied") ||
            message.includes("invalid token") ||
            message.includes("jwt expired");
          // Login itself failing on bad credentials is not an expired session,
          // so it must not sign the user out and bounce them off the form.
          if (isAuthFailure && operation.operationName !== "Login") {
            notifySessionExpired();
          }
        }
        observer.next(result);
      },
      error: (thrown) => {
        observer.error(thrown);
      },
      complete: () => {
        observer.complete();
      },
    });
    // The returned teardown runs when Apollo unsubscribes, so the forwarding
    // subscription is not left running and leaking into the next operation.
    return () => subscription.unsubscribe();
  })
);

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // These are unbounded lists on the server with no pagination args, so
        // they must never be merged field-by-field from cache or a page of 10
        // rows would be stitched onto a cached page of 10 different rows.
        getBankAccounts: { merge: false },
        getUsers: { merge: false },
        getTransactions: { merge: false },
        getPendingApprovals: { merge: false },
        myBankAccounts: { merge: false },
        myTransactions: { merge: false },
        getUserTransactions: { merge: false },
        getAuditLogs: { merge: false },
        getFailedAuditLogs: { merge: false },
        getAuditLogsByActor: { merge: false },
        getBankAccountsByUser: { merge: false },
        getTransactionsByAccount: { merge: false },
      },
    },
  },
});

const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
  connectToDevTools: import.meta.env.DEV,
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network", errorPolicy: "all" },
    query: { fetchPolicy: "network-only", errorPolicy: "all" },
  },
});

export default client;
