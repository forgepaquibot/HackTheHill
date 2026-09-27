import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Asset } from "./UI";

export default function AppHeader({ page }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const {
    isAuthenticated,
    isLoading,
    user,
    logout,
  } = useAuth0();

  function handleLogout() {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  return (
    <header className="header">
      <a className="brand" href="#/" aria-label="Ripple home">
        <Asset screen="5:1224" name="imgRippleMark" />
        <span>Ripple</span>
      </a>

      <nav aria-label="Main navigation">
        <a
          href="#/"
          aria-current={page === "home" ? "page" : undefined}
        >
          Home
        </a>

        <a
          href="#/explore"
          aria-current={page === "explore" ? "page" : undefined}
        >
          Explore Ripples
        </a>

        <a href="#/how-it-works">
          How it Works
        </a>

        <a href="#/organization/invitation">
          For organizations
        </a>
      </nav>

      <div className="header-actions">

        {/* Logged out */}
        {!isLoading && !isAuthenticated && page !== "login" && (
          <a className="header-login" href="#/login">
            Log in
          </a>
        )}

        {/* Logged in */}
        {!isLoading && isAuthenticated && (
          <div className="profile-menu">
            <button
              type="button"
              className="profile-button"
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen(!profileOpen)}
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="profile-avatar"
                />
              ) : (
                <span className="profile-avatar-fallback">
                  {(user?.name || user?.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-info">
                  <strong>
                    {user?.name || user?.nickname || "User"}
                  </strong>

                  {user?.email && (
                    <span>{user.email}</span>
                  )}
                </div>

                <div className="profile-divider" />

                <a
                  href="#/profile"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile
                </a>

                <a
                  href="#/my-reports"
                  onClick={() => setProfileOpen(false)}
                >
                  My reports
                </a>

                <button
                  type="button"
                  className="profile-logout"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Language / accessibility */}
        <div
          className="settings"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.querySelector("button")?.focus();
            }
          }}
        >
          <button
            className="language"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Asset name="imgAccessibility" />

            <span>
              English
              <span className="desktop-label">
                {" · Accessibility"}
              </span>
            </span>

            <Asset name="imgChevronDown" />
          </button>

          {open && (
            <div className="settings-panel">
              <strong>Language & accessibility</strong>

              <p>
                English is currently available.
              </p>

              <label>
                <input
                  type="checkbox"
                  defaultChecked={document.documentElement.classList.contains(
                    "large-text",
                  )}
                  onChange={(e) =>
                    document.documentElement.classList.toggle(
                      "large-text",
                      e.target.checked,
                    )
                  }
                />{" "}
                Larger text
              </label>

              <p>
                All controls support keyboard navigation.
              </p>

              <button onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}