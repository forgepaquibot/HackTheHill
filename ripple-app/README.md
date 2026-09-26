# Ripple frontend

Responsive React + Vite implementation of the Ripple Figma design, with locally bundled Figma assets and the Inter font.

## Run

From `ripple-app`:

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

There is no backend. Report text, photo selection, and edited details remain in React memory and reset on refresh. Nothing is submitted to a city. Review preserves the user's text rather than pretending to perform AI analysis. A new report shows one voice, not a fabricated community match. Photos are selected locally and not uploaded. Text reports can be downloaded after confirmation.

Community reports are fixtures. Follows are saved in localStorage, with a session-only fallback if storage is blocked; no notifications are sent. Map and live nearby search are not connected and explain that in the interface. English is the available language; the accessibility menu offers larger text. Speech recognition uses the browser's speech service, requires microphone permission, and falls back to typing if unavailable.

## Validation

Build, ESLint, and Node tests cover the build pipeline, search/filter combinations, and preservation of draft details. The implementation was also checked with headless Chrome at desktop and mobile widths for navigation, report review/edit/confirm, follows, search, filtering, image loading, and horizontal overflow. Real microphone transcription requires a manual check in a supported browser.

Font license: `public/fonts/LICENSE.txt`.
