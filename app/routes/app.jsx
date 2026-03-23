import { Outlet } from "react-router";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    await authenticate.admin(request);
  } catch (e) {
    // Prevent crash during dev preview boot
    return null;
  }

  return null;
}

export default function AppLayout() {
  return (
    <>
      <NavMenu>
        <a href="/app" rel="home">Dashboard</a>
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