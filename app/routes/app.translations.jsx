import { useMemo, useState } from "react";
import { Form, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const DEFAULT_TRANSLATION_KEYS = [
  { namespace: "general", key: "customize_product", label: "Customize product" },
  { namespace: "general", key: "choose_options_below", label: "Choose your options below" },
  { namespace: "buttons", key: "add_to_cart", label: "Add to cart" },
  { namespace: "buttons", key: "choose_file", label: "Choose file" },
  { namespace: "labels", key: "quantity", label: "Quantity" },
  { namespace: "labels", key: "preview_total", label: "Preview total" },
  { namespace: "labels", key: "select_option", label: "Select an option" },
  { namespace: "messages", key: "required_field", label: "This field is required" },
  { namespace: "messages", key: "upload_failed", label: "Upload failed" },
  { namespace: "messages", key: "uploaded", label: "Uploaded" },
];

function shellCard() {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "20px",
  };
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: "#fff",
    boxSizing: "border-box",
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

  let locales = await prisma.translationLocale.findMany({
    include: { entries: true },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });

  if (locales.length === 0) {
    await prisma.translationLocale.create({
      data: {
        code: "en",
        label: "English",
        isDefault: true,
        enabled: true,
      },
    });

    locales = await prisma.translationLocale.findMany({
      include: { entries: true },
      orderBy: [{ isDefault: "desc" }, { label: "asc" }],
    });
  }

  return {
    locales,
    currentPlan: parseJson(planSetting?.valueJson, { plan: "free" }).plan || "free",
    translationKeys: DEFAULT_TRANSLATION_KEYS,
  };
}

export async function action({ request }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "addLocale") {
    const code = String(formData.get("code") || "").trim().toLowerCase();
    const label = String(formData.get("label") || "").trim();

    if (!code || !label) return { ok: false };

    await prisma.translationLocale.upsert({
      where: { code },
      update: { label, enabled: true },
      create: {
        code,
        label,
        enabled: true,
      },
    });

    return { ok: true };
  }

  if (intent === "setDefault") {
    const localeId = Number(formData.get("localeId"));
    if (!localeId) return { ok: false };

    await prisma.translationLocale.updateMany({
      data: { isDefault: false },
    });

    await prisma.translationLocale.update({
      where: { id: localeId },
      data: { isDefault: true },
    });

    return { ok: true };
  }

  if (intent === "toggleLocale") {
    const localeId = Number(formData.get("localeId"));
    const enabled = String(formData.get("enabled")) === "true";

    await prisma.translationLocale.update({
      where: { id: localeId },
      data: { enabled },
    });

    return { ok: true };
  }

  if (intent === "saveTranslations") {
    const localeId = Number(formData.get("localeId"));
    const entriesJson = String(formData.get("entriesJson") || "[]");
    const entries = parseJson(entriesJson, []);

    if (!localeId) return { ok: false };

    for (const entry of entries) {
      await prisma.translationEntry.upsert({
        where: {
          localeId_namespace_key: {
            localeId,
            namespace: entry.namespace,
            key: entry.key,
          },
        },
        update: {
          value: entry.value,
        },
        create: {
          localeId,
          namespace: entry.namespace,
          key: entry.key,
          value: entry.value,
        },
      });
    }

    return { ok: true };
  }

  return { ok: false };
}

export default function TranslationsPage() {
  const { locales, currentPlan, translationKeys } = useLoaderData();
  const [selectedCode, setSelectedCode] = useState(locales[0]?.code || "en");
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const selectedLocale = useMemo(
    () => locales.find((locale) => locale.code === selectedCode) || locales[0],
    [locales, selectedCode],
  );

  const entryMap = useMemo(() => {
    const map = {};
    (selectedLocale?.entries || []).forEach((entry) => {
      map[`${entry.namespace}.${entry.key}`] = entry.value;
    });
    return map;
  }, [selectedLocale]);

  const [draftValues, setDraftValues] = useState(() => {
    const base = {};
    translationKeys.forEach((item) => {
      base[`${item.namespace}.${item.key}`] =
        entryMap[`${item.namespace}.${item.key}`] || item.label;
    });
    return base;
  });

  function refreshDrafts(nextLocale) {
    const map = {};
    (nextLocale?.entries || []).forEach((entry) => {
      map[`${entry.namespace}.${entry.key}`] = entry.value;
    });

    const base = {};
    translationKeys.forEach((item) => {
      base[`${item.namespace}.${item.key}`] =
        map[`${item.namespace}.${item.key}`] || item.label;
    });
    setDraftValues(base);
  }

  function onChangeLocale(code) {
    setSelectedCode(code);
    const found = locales.find((locale) => locale.code === code);
    refreshDrafts(found);
  }

  const savePayload = translationKeys.map((item) => ({
    namespace: item.namespace,
    key: item.key,
    value: draftValues[`${item.namespace}.${item.key}`] || "",
  }));

  const isFree = currentPlan === "free";

  return (
    <div>
      <div style={{ ...shellCard(), marginBottom: "20px" }}>
        <div style={{ display: "inline-flex", padding: "6px 10px", borderRadius: "999px", background: "#eef2ff", color: "#3730a3", fontSize: "12px", fontWeight: 800, marginBottom: "12px" }}>
          Translations
        </div>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 900, color: "#111827" }}>Translations</h1>
        <p style={{ color: "#6b7280", marginTop: "10px", lineHeight: 1.6 }}>
          Manage translation strings for storefront labels, buttons, helper text, and customer-facing messages.
        </p>
      </div>

      {isFree ? (
        <div style={{ ...shellCard(), marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px", borderColor: "#fcd34d", background: "#fffbeb" }}>
          <div style={{ fontSize: "22px" }}>⚠️</div>
          <div style={{ color: "#111827", fontWeight: 600 }}>
            Translations are not available on the Free plan. Upgrade to Unlimited to use this feature.
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>{selectedLocale?.label || "English"}</div>
        {selectedLocale?.isDefault ? (
          <div style={{ display: "inline-flex", padding: "6px 10px", borderRadius: "999px", background: "#f3f4f6", color: "#4b5563", fontSize: "12px", fontWeight: 800 }}>
            Default
          </div>
        ) : null}

        <div style={{ fontSize: "18px", opacity: 0.7 }}>→</div>

        <select
          value={selectedCode}
          onChange={(e) => onChangeLocale(e.target.value)}
          style={{ ...inputStyle(), width: "220px" }}
        >
          {locales.map((locale) => (
            <option key={locale.id} value={locale.code}>
              {locale.label} ({locale.code})
            </option>
          ))}
        </select>

        <Form method="post">
          <input type="hidden" name="intent" value="setDefault" />
          <input type="hidden" name="localeId" value={selectedLocale?.id || ""} />
          <button type="submit" style={buttonStyle(false)} disabled={!selectedLocale}>
            Set default
          </button>
        </Form>

        <Form method="post">
          <input type="hidden" name="intent" value="toggleLocale" />
          <input type="hidden" name="localeId" value={selectedLocale?.id || ""} />
          <input type="hidden" name="enabled" value={selectedLocale?.enabled ? "false" : "true"} />
          <button type="submit" style={buttonStyle(false)} disabled={!selectedLocale}>
            {selectedLocale?.enabled ? "Disable locale" : "Enable locale"}
          </button>
        </Form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "18px", alignItems: "start" }}>
        <div style={{ ...shellCard(), opacity: isFree ? 0.55 : 1 }}>
          <div style={{ textAlign: "center", padding: "40px 20px 24px" }}>
            <div style={{ fontSize: "72px", lineHeight: 1 }}>🌐</div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#111827", marginTop: "12px" }}>
              Translate and manage your option set
            </div>
            <div style={{ color: "#6b7280", marginTop: "8px" }}>
              Manage languages and tailor custom content for each locale.
            </div>
          </div>

          <Form method="post">
            <input type="hidden" name="intent" value="saveTranslations" />
            <input type="hidden" name="localeId" value={selectedLocale?.id || ""} />
            <input type="hidden" name="entriesJson" value={JSON.stringify(savePayload)} />

            <div style={{ display: "grid", gap: "12px" }}>
              {translationKeys.map((item) => {
                const composite = `${item.namespace}.${item.key}`;
                return (
                  <div key={composite} style={{ border: "1px solid #e5e7eb", borderRadius: "14px", padding: "14px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "8px" }}>
                      {item.namespace.toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 800, color: "#111827", marginBottom: "8px" }}>{item.label}</div>
                    <input
                      style={inputStyle()}
                      value={draftValues[composite] || ""}
                      onChange={(e) =>
                        setDraftValues((prev) => ({
                          ...prev,
                          [composite]: e.target.value,
                        }))
                      }
                      disabled={isFree}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "18px", display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                style={buttonStyle(false)}
                onClick={() => refreshDrafts(selectedLocale)}
                disabled={isFree}
              >
                Reload
              </button>
              <button type="submit" style={buttonStyle(true)} disabled={isFree}>
                Save translations
              </button>
            </div>
          </Form>
        </div>

        <div style={shellCard()}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#111827", marginBottom: "14px" }}>Add language</div>
          <Form method="post">
            <input type="hidden" name="intent" value="addLocale" />
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: "6px" }}>Language name</div>
                <input
                  name="label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={inputStyle()}
                  placeholder="Spanish"
                  disabled={isFree}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: "6px" }}>Language code</div>
                <input
                  name="code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  style={inputStyle()}
                  placeholder="es"
                  disabled={isFree}
                />
              </div>
              <button type="submit" style={buttonStyle(true)} disabled={isFree}>
                Add language
              </button>
            </div>
          </Form>

          <div style={{ marginTop: "20px" }}>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#111827", marginBottom: "12px" }}>Available locales</div>
            <div style={{ display: "grid", gap: "10px" }}>
              {locales.map((locale) => (
                <div key={locale.id} style={{ border: "1px solid #e5e7eb", borderRadius: "14px", padding: "12px" }}>
                  <div style={{ fontWeight: 800 }}>{locale.label}</div>
                  <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
                    {locale.code} • {locale.isDefault ? "Default" : "Secondary"} • {locale.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}