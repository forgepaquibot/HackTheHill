import { useRef, useState } from "react";
import { Asset, Button } from "../components/UI";
import { previewAuthActions } from "../auth/auth0Actions";
import "../styles/login.css";

export default function Login({ authActions = previewAuthActions }) {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const inFlight = useRef(false);

  async function authenticate(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("");
    // The preview password is never read, logged, persisted, or transmitted.
    if (passwordRef.current) passwordRef.current.value = "";
    setShowPassword(false);
    try {
      await authActions[action]({
        email: emailRef.current?.value.trim() || "",
      });
    } catch {
      setMessage(
        authActions.connected
          ? "We couldn’t open secure sign-in. Please try again."
          : "Sign-in is not connected yet. Please try again later.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function handleLink(event, action) {
    event.preventDefault();
    authenticate(action);
  }

  return (
    <main className="login-page">
      <div className="login-decoration" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <a className="brand login-brand" href="#/" aria-label="Ripple home">
          <Asset screen="5:1224" name="imgRippleMark" />
          <span>Ripple</span>
        </a>
        <div className="login-intro">
          <h1 id="login-title" tabIndex="-1">
            Welcome to Ripple
          </h1>
          <p>Your voice can create change.</p>
        </div>
        <p className="login-preview-note" id="login-note">
          {authActions.connected
            ? "Continue to secure sign-in to enter your password."
            : "Login preview — sign-in isn’t available yet. Please don’t enter a real password."}
        </p>
        <form
          className="login-form"
          aria-describedby="login-note"
          aria-busy={pending}
          onSubmit={(event) => {
            event.preventDefault();
            authenticate("login");
          }}
        >
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="you@example.com"
              required
              disabled={pending}
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password">
              <input
                ref={passwordRef}
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                placeholder={
                  authActions.connected
                    ? "Enter securely on the next step"
                    : "Enter your password"
                }
                disabled={pending || authActions.connected}
                aria-describedby="login-note"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="login-password"
                aria-pressed={showPassword}
                disabled={pending || authActions.connected}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <a
            className="login-link login-forgot"
            href="#/login?intent=reset"
            aria-disabled={pending}
            onClick={(event) => handleLink(event, "resetPassword")}
          >
            Forgot password?
          </a>
          <Button type="submit" disabled={pending}>
            {pending ? "Connecting…" : "Log in"}
          </Button>
        </form>
        <div className="login-divider">
          <span /> <span>or</span> <span />
        </div>
        <Button
          secondary
          className="login-google"
          type="button"
          disabled={pending}
          onClick={() => authenticate("google")}
        >
          Continue with Google
        </Button>
        <div
          className="login-feedback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </div>
        <p className="login-signup">
          Don&apos;t have an account?{" "}
          <a
            className="login-link"
            href="#/login?intent=signup"
            aria-disabled={pending}
            onClick={(event) => handleLink(event, "signup")}
          >
            Create account
          </a>
        </p>
      </section>
      <footer className="login-footer">
        <Asset screen="5:1224" name="imgWaves1" />
        <p>Every voice can start a ripple.</p>
      </footer>
    </main>
  );
}
