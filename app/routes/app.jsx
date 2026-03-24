import { Outlet } from "react-router";

export async function loader() {
  return null;
}

export default function AppLayout() {
  return (
    <div style={{ padding: "24px", minHeight: "100vh", background: "#f6f6f7" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dfe3e8",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <h1 style={{ marginTop: 0 }}>MaddOptions App Shell Live</h1>
        <Outlet />
      </div>
    </div>
  );
}