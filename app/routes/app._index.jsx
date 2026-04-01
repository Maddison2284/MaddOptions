export async function loader() {
  return { ok: true };
}

export default function AppIndex() {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "20px",
        padding: "24px",
      }}
    >
      <div style={{ fontSize: "28px", fontWeight: 900, color: "#111827", marginBottom: "8px" }}>
        MaddOptions is loading
      </div>
      <div style={{ color: "#6b7280", lineHeight: 1.6 }}>
        The embedded app shell is working. This confirms the `/app` child route renders.
      </div>
    </div>
  );
}