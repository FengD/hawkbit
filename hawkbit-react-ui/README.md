# hawkbit-react-ui

Standalone React rewrite of the previous Vaadin `hawkbit-ui` module for Eclipse hawkBit OTA server management.

## Features

- Standalone React + TypeScript UI in `hawkbit-react-ui`
- Configurable hawkBit management server URL
- Configurable client branding (app name, logo, primary/accent colors)
- Login with username/password (HTTP Basic)
- Management views for:
  - Targets
  - Target Filters
  - Rollouts
  - Distribution Sets
  - Software Modules (artifact upload)
  - Tenant Configuration
- English/Chinese language switching at runtime
- RSQL query filter synced through URL query param (`q`)

## Requirements

- Node.js 18+
- npm 9+

## Quick Start

```bash
cd hawkbit-react-ui
cp .env.example .env.local
npm install
npm run dev
```

App runs at `http://localhost:5173` by default.

## Server URL Configuration

Set server URL in `.env.local`:

```bash
VITE_HAWKBIT_SERVER_URL=http://localhost:8080
```

All API calls are sent to `${VITE_HAWKBIT_SERVER_URL}/rest/v1`.

## Client Branding Configuration

Configure branding in `.env.local`:

```bash
VITE_APP_NAME=Eclipse hawkBit UI
VITE_APP_LOGO_PATH=/vite.svg
VITE_THEME_PRIMARY=#552583
VITE_THEME_ACCENT=#FDB927
```

- `VITE_APP_NAME`: page/application title shown in shell.
- `VITE_APP_LOGO_PATH`: logo image path served by Vite (`public/...`).
- `VITE_THEME_PRIMARY`: primary color (e.g. sidebar/buttons).
- `VITE_THEME_ACCENT`: accent color (e.g. highlights/borders).

## About Page Markdown

About content is loaded from a markdown file so client teams can edit text easily.

Default:

```bash
public/about.md
```

You can configure another path via:

```bash
VITE_ABOUT_MARKDOWN_PATH=/about.md
```

## Language Switch (Chinese / English)

- Use the language dropdown in the top-right header.
- Supported locales:
  - `en` (English)
  - `zh` (Chinese)
- Selected language is persisted in browser local storage.

## Authentication

- Login uses username and password only.
- React validates credentials through mgmt API endpoint `/rest/v1/userinfo`.
- Requests include `Authorization: Basic ...` header.
- Permissions for menu visibility are derived from the returned user permissions.

## Build

```bash
npm run build
npm run preview
```

## Lint

```bash
npm run lint
```

## Notes

- In development, Vite proxies `/rest/*` to `VITE_HAWKBIT_SERVER_URL` (default `http://localhost:8080`) to avoid browser CORS issues.
- For production deployment on a different origin, backend CORS must still allow your frontend origin.
- This module is intentionally standalone and not embedded into the legacy `hawkbit-ui` packaging.
