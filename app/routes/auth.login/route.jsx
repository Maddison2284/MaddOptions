import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";

function loginErrorMessage(result) {
  if (!result || typeof result !== "object") {
    return {};
  }

  if (result.errors) {
    return result.errors;
  }

  return {};
}

export const loader = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export const action = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export default function AuthLogin() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");

  const { errors } = actionData || loaderData || { errors: {} };

  return (
    <AppProvider embedded={false}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f6f7",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Log in</h1>
          <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 20 }}>
            Enter your Shopify store domain.
          </p>

          <Form method="post">
            <label
              htmlFor="shop"
              style={{ display: "block", fontWeight: 700, marginBottom: 8 }}
            >
              Shop domain
            </label>

            <input
              id="shop"
              name="shop"
              type="text"
              placeholder="example.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              autoComplete="on"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            {errors?.shop ? (
              <div style={{ color: "#b91c1c", marginBottom: 12 }}>
                {errors.shop}
              </div>
            ) : null}

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: "#111827",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          </Form>
        </div>
      </div>
    </AppProvider>
  );
}