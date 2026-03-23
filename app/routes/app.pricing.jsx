import { useState } from "react";
import { Form, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const FAQS = [
  {
    q: "How do I cancel my paid plan?",
    a: "You can switch your app plan back to Free at any time from this page. When you wire Shopify billing later, this same page becomes the handoff to Shopify subscription management.",
  },
  {
    q: "Will I be charged after downgrading?",
    a: "For now this page controls internal feature access in your app. Once Shopify billing is connected, Shopify will control billing timing and proration.",
  },
  {
    q: "What features are limited on Free?",
    a: "Free gives you a clean starter pack. Unlimited unlocks advanced translations, richer controls, more templates, advanced pricing, and the rest of the premium toolkit.",
  },
];

function parseJson(v, fallback) {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export async function loader({ request }) {
  await authenticate.admin(request);

  const planSetting = await prisma.appSetting.findUnique({
    where: { key: "pricing.plan" },
  });

  const cycleSetting = await prisma.appSetting.findUnique({
    where: { key: "pricing.cycle" },
  });

  return {
    currentPlan: parseJson(planSetting?.valueJson, { plan: "free" }).plan || "free",
    currentCycle: parseJson(cycleSetting?.valueJson, { cycle: "monthly" }).cycle || "monthly",
  };
}

export async function action({ request }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "setCycle") {
    const cycle = String(formData.get("cycle") || "monthly");
    await prisma.appSetting.upsert({
      where: { key: "pricing.cycle" },
      update: { valueJson: JSON.stringify({ cycle }) },
      create: { key: "pricing.cycle", valueJson: JSON.stringify({ cycle }) },
    });
    return { ok: true };
  }

  if (intent === "setPlan") {
    const plan = String(formData.get("plan") || "free");
    await prisma.appSetting.upsert({
      where: { key: "pricing.plan" },
      update: { valueJson: JSON.stringify({ plan }) },
      create: { key: "pricing.plan", valueJson: JSON.stringify({ plan }) },
    });
    return { ok: true };
  }

  return { ok: false };
}

function shellCard() {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "20px",
  };
}

function buttonStyle(primary = false) {
  return {
    padding: "10px 14px",
    borderRadius: "12px",
    border: primary ? "none" : "1px solid #d1d5db",
    background: primary ? "#111827" : "#fff",
    color: primary ? "#fff" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
  };
}

export default function PricingPage() {
  const { currentPlan, currentCycle } = useLoaderData();
  const [openFaq, setOpenFaq] = useState(0);

  const monthlyUnlimited = 7.99;
  const annualUnlimited = 7.19;

  return (
    <div>
      <div style={{ ...shellCard(), marginBottom: "20px" }}>
        <div
          style={{
            display: "inline-flex",
            padding: "6px 10px",
            borderRadius: "999px",
            background: "#eef2ff",
            color: "#3730a3",
            fontSize: "12px",
            fontWeight: 800,
            marginBottom: "12px",
          }}
        >
          Pricing
        </div>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 900, color: "#111827" }}>
          Pricing
        </h1>
        <p style={{ color: "#6b7280", marginTop: "10px", lineHeight: 1.6 }}>
          Control feature access by plan. This is ready for app-side gating now. Later, you can wire the same actions to Shopify billing checkout.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
        <div
          style={{
            display: "inline-flex",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: "14px",
            padding: "4px",
            gap: "4px",
          }}
        >
          <Form method="post">
            <input type="hidden" name="intent" value="setCycle" />
            <input type="hidden" name="cycle" value="monthly" />
            <button
              type="submit"
              style={{
                ...buttonStyle(currentCycle === "monthly"),
                minWidth: "120px",
              }}
            >
              Monthly
            </button>
          </Form>

          <Form method="post">
            <input type="hidden" name="intent" value="setCycle" />
            <input type="hidden" name="cycle" value="annually" />
            <button
              type="submit"
              style={{
                ...buttonStyle(currentCycle === "annually"),
                minWidth: "150px",
              }}
            >
              Annually
            </button>
          </Form>

          <div
            style={{
              alignSelf: "center",
              padding: "0 10px",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            Save 10%
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: "22px",
          marginBottom: "24px",
          alignItems: "start",
        }}
      >
        <div style={{ ...shellCard(), minHeight: "420px" }}>
          <div style={{ fontSize: "34px", fontWeight: 900, color: "#111827" }}>Free</div>
          <div style={{ fontSize: "18px", color: "#111827", marginTop: "6px" }}>
            <span style={{ fontSize: "48px", fontWeight: 900 }}>$0</span> /month
          </div>

          <div style={{ marginTop: "18px", marginBottom: "18px" }}>
            <Form method="post">
              <input type="hidden" name="intent" value="setPlan" />
              <input type="hidden" name="plan" value="free" />
              <button
                type="submit"
                style={{
                  ...buttonStyle(currentPlan === "free"),
                  width: "100%",
                  opacity: currentPlan === "free" ? 0.45 : 1,
                }}
              >
                {currentPlan === "free" ? "Current plan" : "Switch to Free"}
              </button>
            </Form>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: "20px",
              color: "#4b5563",
              lineHeight: 1.9,
            }}
          >
            <div>✓ Product options starter pack</div>
            <div>✓ Unlimited option sets</div>
            <div>✓ 15+ option types</div>
            <div>✓ 5 option templates</div>
            <div>✓ Conditional logic</div>
            <div>✓ Live chat support</div>
          </div>
        </div>

        <div style={{ ...shellCard(), minHeight: "420px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{ fontSize: "34px", fontWeight: 900, color: "#111827" }}>Unlimited</div>
            <div
              style={{
                display: "inline-flex",
                padding: "6px 10px",
                borderRadius: "999px",
                background: "#e0f2fe",
                color: "#0369a1",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              🏆 Full access
            </div>
          </div>

          <div style={{ fontSize: "18px", color: "#111827", marginTop: "6px" }}>
            <span style={{ fontSize: "48px", fontWeight: 900 }}>
              ${currentCycle === "annually" ? annualUnlimited.toFixed(2) : monthlyUnlimited.toFixed(2)}
            </span>{" "}
            /month
          </div>

          <div style={{ marginTop: "18px", marginBottom: "18px" }}>
            <Form method="post">
              <input type="hidden" name="intent" value="setPlan" />
              <input type="hidden" name="plan" value="unlimited" />
              <button
                type="submit"
                style={{ ...buttonStyle(true), width: "100%" }}
              >
                {currentPlan === "unlimited" ? "Current Unlimited plan" : "Activate Unlimited"}
              </button>
            </Form>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: "20px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px 30px",
              color: "#4b5563",
              lineHeight: 1.9,
            }}
          >
            <div>✓ All in Free plan</div>
            <div>✓ Full option types access</div>
            <div>✓ 20 option templates</div>
            <div>✓ Price add-on / custom charge</div>
            <div>✓ Add-on sale report</div>
            <div>✓ Option group</div>
            <div>✓ Multiple file upload</div>
            <div>✓ Import/export option sets</div>
            <div>✓ Image dropdown</div>
            <div>✓ Min/max selections with quantity</div>
            <div>✓ Custom size chart</div>
            <div>✓ Edit options in cart page</div>
            <div>✓ Sync options to email/packing slip</div>
            <div>✓ Integrate to Shopify POS</div>
          </div>
        </div>
      </div>

      <div style={shellCard()}>
        <div style={{ fontSize: "24px", fontWeight: 900, color: "#111827", marginBottom: "14px" }}>
          FAQs
        </div>
        <div style={{ display: "grid", gap: "12px" }}>
          {FAQS.map((item, index) => (
            <div
              key={item.q}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 18px",
                  background: "#fff",
                  border: "none",
                  fontWeight: 800,
                  cursor: "pointer",
                  color: "#111827",
                }}
              >
                {item.q}
              </button>
              {openFaq === index ? (
                <div style={{ padding: "0 18px 16px", color: "#6b7280", lineHeight: 1.6 }}>
                  {item.a}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}