# Local Development Environment Setup

This project separates browser-safe front-end config from server-only secrets. Use local environment variables only for Netlify functions and keep sensitive keys out of client-side code.

## What stays in the browser

- `SUPABASE_URL` (public Supabase URL)
- `SUPABASE_ANON_KEY` (publishable anon key)
- `NETLIFY_FUNCTION_BASE` (`/.netlify/functions`)

## What stays server-side only

- `SUPABASE_SERVICE_ROLE_KEY`
- `WEBHOOK_SECRET`
- `FINNHUB_API_KEY`
- `FMP_API_KEY`

These values are consumed only by Netlify functions in `netlify/functions`.

## Local setup

1. Install dependencies:

   ```bash
   cd /Users/lalit/narsi-stocks/ratings/nss-ratings-ui
   npm install
   ```

2. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the secret values in `.env.local`.

4. Start local development:

   Option A: Run the Angular dev server and Netlify functions together in separate terminals.

   Terminal 1:
   ```bash
   npm start
   ```

   Terminal 2:
   ```bash
   netlify dev
   ```

   Option B: Use `netlify dev` if you want the Netlify CLI to manage functions and static assets together. The project is configured to build with `npm run build:dev` in the Netlify dev context.

6. Verify Netlify branch-aware deployment builds:

   - `npm run build:netlify` uses `BRANCH` to choose between `npm run build` and `npm run build:dev`.
   - For example:

      ```bash
      BRANCH=dev npm run build:netlify
      BRANCH=main npm run build:netlify
      ```

5. The Angular app calls server functions through `/ .netlify/functions/` routes in `proxy.conf.json`.

## Notes

- `ng test` does not rely on browser-only API keys, so the project compiles correctly after the service proxy changes.
- `npm run build` uses `src/environments/environment.ts` for production and does not expose server-only keys.
- `npm run build:dev` uses `src/environments/environment.development.ts` for local dev settings.
- `npm run build:netlify` is the branch-aware command used by Netlify build to select the right Angular configuration.
- Do not add `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`, `FINNHUB_API_KEY`, or `FMP_API_KEY` to `src/environments/*.ts`.

## How server functions use env vars

- `netlify/functions/finnhub-proxy.js` uses `process.env.FINNHUB_API_KEY`
- `netlify/functions/fmp-proxy.js` uses `process.env.FMP_API_KEY`
- `netlify/functions/screener-webhook.js` uses `process.env.SUPABASE_URL`, `process.env.SUPABASE_SERVICE_ROLE_KEY`, and `process.env.WEBHOOK_SECRET`

There is no `screener_setups` Supabase table in the current repository. The app and functions currently reference:
   - `mostActive`
   - `screener_signals`

## Verifying local behavior

- `npm run build:dev` should succeed.
- `npm run build` should succeed.
- `npm test -- --watch=false` should succeed.
- When running locally, requests to `/.netlify/functions/` should proxy correctly to the Netlify functions runtime.
