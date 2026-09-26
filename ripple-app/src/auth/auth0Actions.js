/**
 * Connect with createAuth0Actions(useAuth0().loginWithRedirect) inside an
 * Auth0Provider. Auth0 owns credentials, sessions, signup, and password reset.
 * Only an optional email hint crosses this boundary; never pass a password.
 */
export function createAuth0Actions(loginWithRedirect) {
  const redirect = (authorizationParams = {}) =>
    loginWithRedirect({
      appState: { returnTo: "/" },
      authorizationParams,
    });
  return {
    connected: true,
    login: ({ email } = {}) => redirect(email ? { login_hint: email } : {}),
    google: () => redirect({ connection: "google-oauth2" }),
    signup: () => redirect({ screen_hint: "signup" }),
    // Universal Login supplies the password reset link; no custom reset API.
    resetPassword: ({ email } = {}) =>
      redirect({ prompt: "login", ...(email ? { login_hint: email } : {}) }),
  };
}

async function unavailable() {
  throw new Error("Sign-in is not connected yet. Please try again later.");
}

export const previewAuthActions = Object.freeze({
  connected: false,
  login: unavailable,
  google: unavailable,
  signup: unavailable,
  resetPassword: unavailable,
});
