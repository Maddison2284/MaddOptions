# MaddOptions deployment checklist

## Why the dev store load was failing

1. `shopify.app.toml` had `automatically_update_urls_on_dev = false`, which prevents Shopify CLI from rewriting the app URL and auth callbacks to the active tunnel during `shopify app dev`.
2. The embedded `/app` route swallowed `authenticate.admin()` redirects, so Shopify could not complete the embedded auth bounce cleanly.
3. The storefront app proxy route was not validating signed app-proxy requests.

## Correct execution order

1. Set the environment variables used by the app:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `SHOPIFY_APP_URL`
   - `SCOPES`
   - `DATABASE_URL`
   - `SHOP_CUSTOM_DOMAIN` (production only, optional)
2. Install dependencies:
   - `npm ci`
3. Generate Prisma client and apply committed migrations:
   - `npm run setup`
4. Start local Shopify development:
   - `npm run dev`
5. Reinstall or open the app from the Shopify dev store so Shopify picks up the dev tunnel and updated auth URL.
6. In the theme editor, add the **Madd Options** app block to the product template.
7. For production deploys:
   - build with `npm run build`
   - run migrations with `npx prisma migrate deploy`
   - start with `npm run start`
8. After production is live on Cloudflare/custom hosting:
   - set `SHOPIFY_APP_URL=https://app.maddoptions.com`
   - set `SHOP_CUSTOM_DOMAIN=app.maddoptions.com` if you are using a Shopify custom app domain
   - run `shopify app deploy` so Shopify syncs the app URL, proxy, and extension config

## Cloudflare/domain notes

- Keep Cloudflare in **Full (strict)** SSL mode so Shopify callbacks stay HTTPS end to end.
- Proxy the `app.maddoptions.com` DNS record to the production host only after the host serves valid TLS.
- Do not use HTML caching on authenticated `/app` routes.
- Exclude `/auth/*`, `/webhooks/*`, and `/apps/maddoptions` from aggressive edge caching.
- Preserve query strings on `/auth/*` and `/apps/maddoptions` because Shopify signs proxy/auth requests with URL parameters.
