import { useState } from "react";
import { Asset } from "./UI";
export default function AppHeader({ page }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <a className="brand" href="#/" aria-label="Ripple home">
        <Asset screen="5:1224" name="imgRippleMark" />
        <span>Ripple</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#/" aria-current={page === "home" ? "page" : undefined}>
          Home
        </a>
        <a
          href="#/explore"
          aria-current={page === "explore" ? "page" : undefined}
        >
          Explore Ripples
        </a>
        <a href="#/how-it-works">How it Works</a>
      </nav>
      <div className="header-actions">
        {page !== "login" && (
          <a className="header-login" href="#/login">
            Log in
          </a>
        )}
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
              English<span className="desktop-label"> · Accessibility</span>
            </span>
            <Asset name="imgChevronDown" />
          </button>
          {open && (
            <div className="settings-panel">
              <strong>Language & accessibility</strong>
              <p>English is currently available.</p>
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
              <p>All controls support keyboard navigation.</p>
              <button onClick={() => setOpen(false)}>Close</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
