import { Outlet, useLoaderData, useRouteError } from "react-router";
import { AppProvider, NavMenu } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function AppLayout() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Dashboard</a>
        <a href="/app/option-sets">Option Sets</a>
        <a href="/app/assignments">Assignments</a>
        <a href="/app/templates">Templates</a>
        <a href="/app/settings">Settings</a>
        <a href="/app/pricing">Pricing</a>
        <a href="/app/translations">Translations</a>
        <a href="/app/variant-options">Variant Options</a>
        <a href="/app/advanced-features">Advanced Features</a>
      </NavMenu>

      <div
        style={{
          minHeight: "100vh",
          background: "#f6f6f7",
          padding: "24px",
        }}
      >
        <Outlet />
      </div>
    </AppProvider>
  );
}