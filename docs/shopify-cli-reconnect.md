# MaddOptions Shopify CLI reconnect guide

This repo should use **two Shopify app configs**:

1. **Committed production config**: `shopify.app.toml`
   - stays pinned to `https://app.maddoptions.com`
   - should **not** be rewritten by `shopify app dev`
2. **Local development config**: `shopify.app.development.toml`
   - linked to the Shopify **dev app**
   - allows Shopify CLI to rewrite the App URL, redirect URLs, and app proxy to the active tunnel during local testing

## Short answer: can local Shopify CLI run through `app.maddoptions.com`?

**Not directly for normal local development.**

If you run `shopify app dev`, Shopify CLI expects a reachable local server and usually exposes it with either:

- a Shopify/Cloudflare quick tunnel, or
- your own tunnel via `shopify app dev --tunnel-url=...`

So `app.maddoptions.com` should stay your **deployed host**. For local testing, use a separate **development config** and let Shopify CLI rewrite the dev app to the current tunnel.

You should only use `app.maddoptions.com` during development if that domain is already serving the app publicly, or if you deliberately proxy that domain to your local machine with your own tunnel/reverse-proxy setup.

## Recommended reconnect flow

### 1. Keep production pinned

The committed `shopify.app.toml` now keeps:

- `application_url = "https://app.maddoptions.com"`
- production redirect URLs
- production app proxy URL
- `automatically_update_urls_on_dev = false`

That prevents accidental local `shopify app dev` sessions from rewriting your committed production app config.

### 2. Create/link a development config

Run:

```bash
shopify app config link
```

If Shopify CLI sees `shopify.app.toml` already exists, it can use the tracked development config in this repo:

```bash
shopify.app.development.toml
```

Open that file and replace the placeholder `client_id` with the client ID for the Shopify dev app you want to test.

### 3. Make the development config active

Either:

```bash
shopify app config use development
```

or run commands explicitly with:

```bash
shopify app dev --config development
shopify app deploy --config production
```

### 4. Enable URL rewriting only on the dev config

In `shopify.app.development.toml`, keep:

```toml
[build]
automatically_update_urls_on_dev = true
```

That lets Shopify CLI update the dev app's:

- App URL
- redirect URLs
- app proxy host

to the active tunnel during `shopify app dev`.

### 5. Reinstall/reopen the app in the dev store

After the dev config is linked and `shopify app dev --config development` is running:

1. open the selected dev store
2. open the app from the Shopify admin
3. if Shopify still points at old URLs, uninstall and reinstall the dev app once

## When to use each setup

### Use Shopify tunnel / CLI dev config when:

- testing embedded admin auth
- testing OAuth callback flow
- testing app proxy responses from the storefront
- iterating locally

### Use `app.maddoptions.com` when:

- testing the deployed environment
- validating Cloudflare, DNS, TLS, and production callbacks
- testing a stable external environment shared with others

## Suggested commands

### Local development with the dev config

```bash
npm ci
npm run setup
shopify app dev --config development
```

### Local development with your own tunnel

```bash
ngrok http 3000
shopify app dev --config development --tunnel-url=https://YOUR-NGROK-HOST:3000
```

### Production deployment

```bash
npm run build
npx prisma migrate deploy
shopify app deploy
```
