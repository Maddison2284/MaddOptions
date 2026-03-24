import { route, index } from "@react-router/dev/routes";

export default [
  index("./routes/_index/route.jsx"),

  route("app", "./routes/app.jsx", [
    index("./routes/app._index.jsx"),
  ]),

  route("auth/login", "./routes/auth.login/route.jsx"),
  route("auth/*", "./routes/auth.$.jsx"),

  route("apps/maddoptions", "./routes/apps.maddoptions.jsx"),
  route("api/upload", "./routes/api.upload.jsx"),
  route("api/shopify-files", "./routes/api.shopify-files.jsx"),

  route("webhooks/app/scopes_update", "./routes/webhooks.app.scopes_update.jsx"),
  route("webhooks/app/uninstalled", "./routes/webhooks.app.uninstalled.jsx"),
];