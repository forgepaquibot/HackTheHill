# Ripple frontend

Responsive React + Vite implementation of the Ripple Figma design, with locally bundled Figma assets and the Inter font.

## Run

Set `ELEVENLABS_API_KEY` in a root `.env` file or in the backend process environment. Do not use a `VITE_`-prefixed key; browser code must not contain the ElevenLabs API key. Start the API from the repository root:

```sh
uvicorn main:app --reload
```

Then, from `ripple-app`:

```sh
npm install
npm run dev
```

```sh
npm run build
npm run lint
npm test
```

## Screens and behavior

- `#/` — home, Speak/Type entry points, How it Works.
- `#/report` — speech recognition where supported, typed report, optional location/category/photo.
- `#/review` — editable report summary; requires a draft from the report screen.
- `#/created` — confirmation for the current report, status timeline, local follow state, text download.
- `#/explore` — six example community reports, search and category filters, follow buttons.
- `#/ripple/:id` — uses the designed Ripple result layout to show a selected example.

Navigation supports browser back/forward. Layouts adapt to the desktop and mobile Figma frames. Shared colors live in `src/styles/tokens.css`; layout styles are in `src/App.css`; the asset manifest maps Figma node IDs to local exports.

## Demo boundaries

Report text, photo selection, and edited details remain in React memory and reset on refresh. Nothing is submitted to a city. The backend only issues short-lived ElevenLabs Scribe tokens for voice transcription; review preserves the user's text rather than pretending to perform AI analysis. A new report shows one voice, not a fabricated community match. Photos are selected locally and not uploaded. Text reports can be downloaded after confirmation.

Community reports are fixtures. Follows are saved in localStorage, with a session-only fallback if storage is blocked; no notifications are sent. Map and live nearby search are not connected and explain that in the interface. English is the available language; the accessibility menu offers larger text. Voice transcription uses ElevenLabs Scribe, requires microphone permission and a configured backend API key, and falls back to typing if unavailable.

## Validation

Build, ESLint, and Node tests cover the build pipeline, search/filter combinations, and preservation of draft details. The implementation was also checked with headless Chrome at desktop and mobile widths for navigation, report review/edit/confirm, follows, search, filtering, image loading, and horizontal overflow. Real microphone transcription requires a manual check in a supported browser.

Font license: `public/fonts/LICENSE.txt`.

## Login page and Auth0 handoff

Open `#/login` or choose **Log in** in the header. The page reuses the Ripple logo, shared `Button`/`Asset` components, colors, typography, and focus styles. It includes the requested email/password preview, show/hide toggle, Google action, signup and reset links, and responsive layout.

Authentication is intentionally **not connected**. The page says so before the form and never reports a successful login. The preview password exists only in its input element, is cleared on an authentication action, and is never read, saved, logged, or transmitted. The backend's `main.py` was inspected and left unchanged: protected endpoints validate Auth0 RS256 access tokens against `AUTH0_DOMAIN` and `AUTH0_API_AUDIENCE`.

To connect the team's Auth0 SPA application:

1. Use the official `@auth0/auth0-react` SDK and an `Auth0Provider` with the team's public domain/client ID, a registered callback URL, and an `audience` matching the backend's `AUTH0_API_AUDIENCE`. Never put a client secret in Vite variables.
2. Inside the provider, pass `createAuth0Actions(loginWithRedirect)` from `src/auth/auth0Actions.js` to `<Login authActions={...} />`. The adapter uses only an optional `login_hint`, `screen_hint: "signup"`, or the `google-oauth2` connection. Enable that Google connection for the Auth0 application.
3. Handle the callback using the SDK, returning to the hash route in `appState.returnTo`. The local password field becomes disabled when connected; Auth0 Universal Login collects credentials and provides the password-reset link. For an exact branded email/password screen in production, apply this design to the Auth0-hosted experience rather than adding a password API to this SPA.
4. Use the SDK's access-token retrieval for authorized API requests. Account registration/sync and protected report submission are separate integration work; this page does not call those endpoints or bypass the backend's verification checks.

References: [Auth0 React quickstart](https://auth0.com/docs/quickstart/spa/react), [Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login).

Reports now require a separate title. Review allows editing both title and description; confirmation and the downloaded report preserve those edits. `buildComplaintPayload(review)` produces `{ title, description, category, force_submit: false }`, matching `backend/main.py`'s request model and the database's separate title/description columns. Live API submission remains unconnected.
