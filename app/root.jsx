import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

export async function loader() {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
}

function AppShell() {
  const { apiKey } = useLoaderData();
  const location = useLocation();

  const isStorefrontRoute = location.pathname.startsWith("/apps/");

  if (isStorefrontRoute) {
    return <Outlet />;
  }

  return (
    <AppProvider embedded apiKey={apiKey}>
      <Outlet />
    </AppProvider>
  );
}

export default function App() {
  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <AppShell />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}