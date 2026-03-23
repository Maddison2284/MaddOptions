import { Outlet } from "react-router";
import { NavMenu } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function AppLayout() {
  return (
    <>
      <NavMenu>
        <a href="/app" rel="home">
          Dashboard
        </a>
        <a href="/app/option-sets">Option Sets</a>
        <a href="/app/templates">Templates</a>
        <a href="/app/settings">Settings</a>
        <a href="/app/translations">Translations</a>
        <a href="/app/variant-options">Variant Options</a>
        <a href="/app/pricing">Pricing</a>
        <a href="/app/advanced-features">Advanced Features</a>
      </NavMenu>

      <div style={{ padding: "20px" }}>
        <Outlet />
      </div>
    </>
  );
}
