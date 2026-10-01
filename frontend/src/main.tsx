import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { BrowserRouter } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

import App from "./App";
import client from "./graphql/client";
import theme from "./theme";
import { ToastProvider } from "./components/common/ToastProvider";
import { AuthProvider } from "./auth/AuthContext";

/**
 * Provider order matters and is not arbitrary:
 *
 *   ApolloProvider   — everything below may issue a query.
 *   ThemeProvider    — Material styling for everything below.
 *   ToastProvider    — AuthProvider reports session expiry through it, so it
 *                      must be inside Apollo and outside Auth.
 *   AuthProvider     — reads the token on mount and validates it, so it wraps
 *                      the router: `RequireAuth` needs a user to decide what to
 *                      render at all.
 *   BrowserRouter    — innermost, because AuthProvider's guards are route
 *                      elements and must be under a router context.
 */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ApolloProvider>
  </StrictMode>
);
