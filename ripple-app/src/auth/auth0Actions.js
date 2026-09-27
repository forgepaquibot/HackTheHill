/**
 * Auth0 authentication actions.
 *
 * Auth0 owns:
 * - credentials
 * - login
 * - signup
 * - Google login
 * - password reset
 * - authenticated sessions
 *
 * The application never receives or handles the user's password.
 */

export function createAuth0Actions(loginWithRedirect) {
  const redirect = (authorizationParams = {}) =>
    loginWithRedirect({
      appState: {
        returnTo: "/",
      },
      authorizationParams,
    });

  return {
    connected: true,

    login: ({ email } = {}) =>
      redirect(email ? { login_hint: email } : {}),

    google: () =>
      redirect({
        connection: "google-oauth2",
      }),

    signup: () =>
      redirect({
        screen_hint: "signup",
      }),

    resetPassword: ({ email } = {}) =>
      redirect({
        prompt: "login",
        ...(email ? { login_hint: email } : {}),
      }),
  };
}

/*
 * Preview fallback.
 *
 * This is only used if a component is rendered without the real
 * Auth0 actions. Once App.jsx passes createAuth0Actions(...),
 * these should no longer be used.
 */

async function unavailable() {
  throw new Error(
    "Sign-in is not connected yet. Please try again later."
  );
}

export const previewAuthActions = Object.freeze({
  connected: false,
  login: unavailable,
  google: unavailable,
  signup: unavailable,
  resetPassword: unavailable,
});