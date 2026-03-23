export default function TemplatesPage() {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "22px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          padding: "6px 10px",
          borderRadius: "999px",
          background: "#f3f4f6",
          color: "#111827",
          fontSize: "12px",
          fontWeight: 800,
          marginBottom: "12px",
        }}
      >
        Templates
      </div>

      <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 900, color: "#111827" }}>
        Templates
      </h1>
      <p style={{ color: "#6b7280", marginTop: "10px", lineHeight: 1.6 }}>
        This page is ready for reusable option-set templates like Gift Box, Engraving, Personalized Text, File Upload, and Bundle presets.
      </p>
    </div>
  );
}