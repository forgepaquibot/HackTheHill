import { useEffect, useRef, useState } from "react";
import { Asset, Button } from "../components/UI";
import { useAuth0 } from "@auth0/auth0-react";
import "../styles/login.css";

export default function Login() {
  const {
    loginWithRedirect,
    isAuthenticated,
    isLoading,
    error,
  } = useAuth0();

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (error) {
      setMessage(
        "We couldn’t complete secure sign-in. Please try again."
      );
    }
  }, [error]);

  async function authenticate(action) {
    if (inFlight.current || isLoading) return;

    inFlight.current = true;
    setPending(true);
    setMessage("");

    try {
      if (action === "login") {
        await loginWithRedirect({
          authorizationParams: {
            screen_hint: "login",
          },
        });
      }

      if (action === "google") {
        await loginWithRedirect({
          authorizationParams: {
            connection: "google-oauth2",
          },
        });
      }

      if (action === "signup") {
        await loginWithRedirect({
          authorizationParams: {
            screen_hint: "signup",
          },
        });
      }

      if (action === "resetPassword") {
        await loginWithRedirect({
          authorizationParams: {
            screen_hint: "login",
          },
          appState: {
            returnTo: "/login",
          },
        });
      }
    } catch {
      setMessage(
        "We couldn’t open secure sign-in. Please try again."
      );
      inFlight.current = false;
      setPending(false);
    }
  }

  function handleLink(event, action) {
    event.preventDefault();
    authenticate(action);
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="login-page">
      <div className="login-decoration" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <a
          className="brand login-brand"
          href="#/"
          aria-label="Ripple home"
        >
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
          Continue to secure sign-in with Auth0.
        </p>

        <div
          className="login-form"
          aria-busy={pending}
          aria-describedby="login-note"
        >
          <Button
            type="button"
            disabled={pending || isLoading}
            onClick={() => authenticate("login")}
          >
            {pending ? "Connecting…" : "Log in"}
          </Button>
        </div>

        <div className="login-divider">
          <span />
          <span>or</span>
          <span />
        </div>

        <Button
          secondary
          className="login-google"
          type="button"
          disabled={pending || isLoading}
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

        <p className="login-signup">
          <a
            className="login-link"
            href="#/login?intent=reset"
            aria-disabled={pending}
            onClick={(event) =>
              handleLink(event, "resetPassword")
            }
          >
            Forgot password?
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