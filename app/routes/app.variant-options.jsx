export default function VariantOptionsPage() {
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
        Variant Options
      </div>

      <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 900, color: "#111827" }}>
        Variant Options
      </h1>
      <p style={{ color: "#6b7280", marginTop: "10px", lineHeight: 1.6 }}>
        This page is ready for linking option choices to product variants, variant-specific availability, and swatch-to-variant behavior.
      </p>
    </div>
  );
}