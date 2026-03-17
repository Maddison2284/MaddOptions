import { Outlet, NavLink } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

const navItems = [
  { label: "Dashboard", to: "/app" },
  { label: "Assignments", to: "/app/assignments" },
];

function navLinkStyle({ isActive }) {
  return {
    display: "block",
    padding: "10px 12px",
    borderRadius: "10px",
    textDecoration: "none",
    color: isActive ? "#111827" : "#4b5563",
    background: isActive ? "#eef2ff" : "transparent",
    fontWeight: isActive ? 700 : 500,
    marginBottom: "6px",
  };
}

export default function AppLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: "20px",
        }}
      >
        <aside
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            alignSelf: "start",
            position: "sticky",
            top: "20px",
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#111827",
                marginBottom: "4px",
              }}
            >
              MaddOptions
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280" }}>
              Product options for Shopify
            </div>
          </div>

          <div style={{ marginBottom: "10px", fontSize: "12px", color: "#9ca3af", fontWeight: 700 }}>
            NAVIGATION
          </div>

          <nav>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/app"} style={navLinkStyle}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}