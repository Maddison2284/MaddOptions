import { route, index } from "@react-router/dev/routes";

export default [
  index("./routes/_index/route.jsx"),

  route("apps/maddoptions", "./routes/apps.maddoptions.jsx"),

  route("app", "./routes/app.jsx", [
    index("./routes/app._index.jsx"),
    route("additional", "./routes/app.additional.jsx"),
    route("advanced-features", "./routes/app.advanced-features.jsx"),
    route("assignments", "./routes/app.assignments.jsx"),
    route("option-sets", "./routes/app.option-sets.jsx"),
    route("pricing", "./routes/app.pricing.jsx"),
    route("settings", "./routes/app.settings.jsx"),
    route("templates", "./routes/app.templates.jsx"),
    route("translations", "./routes/app.translations.jsx"),
    route("variant-options", "./routes/app.variant-options.jsx"),
  ]),

  route("auth/login", "./routes/auth.login/route.jsx"),
  route("auth/*", "./routes/auth.$.jsx"),

  route("api/shopify-files", "./routes/api.shopify-files.jsx"),
  route("api/upload", "./routes/api.upload.jsx"),

  route("webhooks/app/scopes_update", "./routes/webhooks.app.scopes_update.jsx"),
  route("webhooks/app/uninstalled", "./routes/webhooks.app.uninstalled.jsx"),
];