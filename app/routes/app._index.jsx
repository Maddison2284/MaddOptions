export async function loader() {
  return { ok: true };
}

export default function DashboardPage() {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dfe3e8",
        borderRadius: "12px",
        padding: "24px",
        marginTop: "16px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Dashboard Route Live</h2>
      <p>This is a minimal working test page.</p>
    </div>
  );
}