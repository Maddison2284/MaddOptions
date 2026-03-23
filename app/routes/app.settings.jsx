import { useMemo, useState } from "react";
import { Form, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const DEFAULTS = {
  general: {
    formHeight: "full",
    deselectAction: "click_again",
    showSelectedOptionValueOnLabel: true,
  },
  text: {
    singleLineMax: 100,
    multiLineMax: 300,
    placeholderTone: "soft",
  },
  toggle: {
    defaultOn: false,
    style: "pill",
  },
  singleCheckbox: {
    checkedIcon: "check",
    allowRequired: true,
  },
  colorSwatch: {
    shape: "circle",
    size: "medium",
    showLabel: true,
    borderStyle: "outline",
  },
  imageSwatch: {
    shape: "square",
    size: "medium",
    showLabel: true,
    imageFit: "cover",
  },
  uploadPhoto: {
    accept: ".jpg,.jpeg,.png",
    maxFileSizeMb: 10,
    buttonText: "Choose file",
  },
  addonPrice: {
    displayMode: "suffix",
    prefix: "+",
    decimals: 2,
  },
  cartSettings: {
    showOptionSummary: true,
    showTotalPrice: true,
    editInCart: true,
  },
  checkoutSettings: {
    syncToNote: false,
    syncToPackingSlip: false,
  },
  advancedSettings: {
    conditionalLogic: true,
    minMaxSelections: true,
    quantitySelector: true,
  },
};

const SECTIONS = [
  { key: "text", label: "Single & Multi-line Text", icon: "A" },
  { key: "toggle", label: "Toggle", icon: "◉" },
  { key: "singleCheckbox", label: "Single checkbox", icon: "☑" },
  { key: "colorSwatch", label: "Color Swatch", icon: "◌" },
  { key: "imageSwatch", label: "Image Swatch", icon: "▣" },
  { key: "uploadPhoto", label: "Upload Photo", icon: "⤴" },
  { key: "addonPrice", label: "Add-on Price", icon: "+" },
  { key: "cartSettings", label: "Cart settings", icon: "🛒" },
  { key: "checkoutSettings", label: "Checkout settings", icon: "⇢" },
  { key: "advancedSettings", label: "Advanced settings", icon: "⚙" },
];

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function getSetting(key, fallback) {
  const found = await prisma.appSetting.findUnique({ where: { key } });
  return found ? parseJson(found.valueJson, fallback) : fallback;
}

export async function loader({ request }) {
  await authenticate.admin(request);

  const settings = {
    general: await getSetting("settings.general", DEFAULTS.general),
    text: await getSetting("settings.text", DEFAULTS.text),
    toggle: await getSetting("settings.toggle", DEFAULTS.toggle),
    singleCheckbox: await getSetting("settings.singleCheckbox", DEFAULTS.singleCheckbox),
    colorSwatch: await getSetting("settings.colorSwatch", DEFAULTS.colorSwatch),
    imageSwatch: await getSetting("settings.imageSwatch", DEFAULTS.imageSwatch),
    uploadPhoto: await getSetting("settings.uploadPhoto", DEFAULTS.uploadPhoto),
    addonPrice: await getSetting("settings.addonPrice", DEFAULTS.addonPrice),
    cartSettings: await getSetting("settings.cartSettings", DEFAULTS.cartSettings),
    checkoutSettings: await getSetting("settings.checkoutSettings", DEFAULTS.checkoutSettings),
    advancedSettings: await getSetting("settings.advancedSettings", DEFAULTS.advancedSettings),
  };

  return { settings };
}

export async function action({ request }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const sectionKey = String(formData.get("sectionKey") || "");
  const sectionJson = String(formData.get("sectionJson") || "{}");

  if (!sectionKey) {
    return { ok: false };
  }

  await prisma.appSetting.upsert({
    where: { key: `settings.${sectionKey}` },
    update: { valueJson: sectionJson },
    create: {
      key: `settings.${sectionKey}`,
      valueJson: sectionJson,
    },
  });

  return { ok: true };
}

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

function SectionField({ label, children, help }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ fontWeight: 800, color: "#111827", marginBottom: "8px" }}>{label}</div>
      {children}
      {help ? (
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px", lineHeight: 1.5 }}>
          {help}
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const { settings: loadedSettings } = useLoaderData();
  const [activeSection, setActiveSection] = useState("general");
  const [settings, setSettings] = useState(loadedSettings);

  const preview = useMemo(() => {
    return settings;
  }, [settings]);

  function update(section, field, value) {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }

  function renderSectionEditor() {
    if (activeSection === "general") {
      return (
        <>
          <SectionField label="Form height">
            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <input
                  type="radio"
                  checked={settings.general.formHeight === "full"}
                  onChange={() => update("general", "formHeight", "full")}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>Show full</div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Show full height of the form.</div>
                </div>
              </label>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <input
                  type="radio"
                  checked={settings.general.formHeight === "scrollable"}
                  onChange={() => update("general", "formHeight", "scrollable")}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>Fixed height & scrollable</div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>
                    Limit the height and let customers scroll for the rest.
                  </div>
                </div>
              </label>
            </div>
          </SectionField>

          <SectionField label="Deselect action (for optional fields)">
            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="radio"
                  checked={settings.general.deselectAction === "button"}
                  onChange={() => update("general", "deselectAction", "button")}
                />
                Show a deselect button
              </label>
              <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="radio"
                  checked={settings.general.deselectAction === "click_again"}
                  onChange={() => update("general", "deselectAction", "click_again")}
                />
                Click again to deselect
              </label>
            </div>
          </SectionField>

          <SectionField label="Option labels">
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.general.showSelectedOptionValueOnLabel}
                onChange={(e) =>
                  update("general", "showSelectedOptionValueOnLabel", e.target.checked)
                }
              />
              Show selected option value on option label
            </label>
          </SectionField>
        </>
      );
    }

    if (activeSection === "text") {
      return (
        <>
          <SectionField label="Single line max characters">
            <input
              value={settings.text.singleLineMax}
              onChange={(e) => update("text", "singleLineMax", Number(e.target.value || 0))}
              style={inputStyle()}
            />
          </SectionField>
          <SectionField label="Multi-line max characters">
            <input
              value={settings.text.multiLineMax}
              onChange={(e) => update("text", "multiLineMax", Number(e.target.value || 0))}
              style={inputStyle()}
            />
          </SectionField>
          <SectionField label="Placeholder tone">
            <select
              value={settings.text.placeholderTone}
              onChange={(e) => update("text", "placeholderTone", e.target.value)}
              style={inputStyle()}
            >
              <option value="soft">Soft</option>
              <option value="standard">Standard</option>
              <option value="bold">Bold</option>
            </select>
          </SectionField>
        </>
      );
    }

    if (activeSection === "toggle") {
      return (
        <>
          <SectionField label="Default toggle state">
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.toggle.defaultOn}
                onChange={(e) => update("toggle", "defaultOn", e.target.checked)}
              />
              Toggle starts enabled
            </label>
          </SectionField>
          <SectionField label="Toggle style">
            <select
              value={settings.toggle.style}
              onChange={(e) => update("toggle", "style", e.target.value)}
              style={inputStyle()}
            >
              <option value="pill">Pill</option>
              <option value="square">Square</option>
              <option value="minimal">Minimal</option>
            </select>
          </SectionField>
        </>
      );
    }

    if (activeSection === "singleCheckbox") {
      return (
        <>
          <SectionField label="Checked icon">
            <select
              value={settings.singleCheckbox.checkedIcon}
              onChange={(e) => update("singleCheckbox", "checkedIcon", e.target.value)}
              style={inputStyle()}
            >
              <option value="check">Check</option>
              <option value="tick_box">Tick box</option>
              <option value="dot">Dot</option>
            </select>
          </SectionField>
          <SectionField label="Required single checkbox">
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.singleCheckbox.allowRequired}
                onChange={(e) => update("singleCheckbox", "allowRequired", e.target.checked)}
              />
              Allow required mode
            </label>
          </SectionField>
        </>
      );
    }

    if (activeSection === "colorSwatch") {
      return (
        <>
          <SectionField label="Swatch shape">
            <select
              value={settings.colorSwatch.shape}
              onChange={(e) => update("colorSwatch", "shape", e.target.value)}
              style={inputStyle()}
            >
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="rounded">Rounded</option>
            </select>
          </SectionField>
          <SectionField label="Swatch size">
            <select
              value={settings.colorSwatch.size}
              onChange={(e) => update("colorSwatch", "size", e.target.value)}
              style={inputStyle()}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </SectionField>
          <SectionField label="Border style">
            <select
              value={settings.colorSwatch.borderStyle}
              onChange={(e) => update("colorSwatch", "borderStyle", e.target.value)}
              style={inputStyle()}
            >
              <option value="outline">Outline</option>
              <option value="soft">Soft</option>
              <option value="none">None</option>
            </select>
          </SectionField>
          <SectionField label="Show labels">
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.colorSwatch.showLabel}
                onChange={(e) => update("colorSwatch", "showLabel", e.target.checked)}
              />
              Show swatch labels under the color
            </label>
          </SectionField>
        </>
      );
    }

    if (activeSection === "imageSwatch") {
      return (
        <>
          <SectionField label="Image swatch shape">
            <select
              value={settings.imageSwatch.shape}
              onChange={(e) => update("imageSwatch", "shape", e.target.value)}
              style={inputStyle()}
            >
              <option value="square">Square</option>
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
            </select>
          </SectionField>
          <SectionField label="Image swatch size">
            <select
              value={settings.imageSwatch.size}
              onChange={(e) => update("imageSwatch", "size", e.target.value)}
              style={inputStyle()}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </SectionField>
          <SectionField label="Image fit">
            <select
              value={settings.imageSwatch.imageFit}
              onChange={(e) => update("imageSwatch", "imageFit", e.target.value)}
              style={inputStyle()}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </SectionField>
          <SectionField label="Show labels">
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.imageSwatch.showLabel}
                onChange={(e) => update("imageSwatch", "showLabel", e.target.checked)}
              />
              Show swatch labels under images
            </label>
          </SectionField>
        </>
      );
    }

    if (activeSection === "uploadPhoto") {
      return (
        <>
          <SectionField label="Accepted file types">
            <input
              value={settings.uploadPhoto.accept}
              onChange={(e) => update("uploadPhoto", "accept", e.target.value)}
              style={inputStyle()}
            />
          </SectionField>
          <SectionField label="Max file size (MB)">
            <input
              value={settings.uploadPhoto.maxFileSizeMb}
              onChange={(e) => update("uploadPhoto", "maxFileSizeMb", Number(e.target.value || 0))}
              style={inputStyle()}
            />
          </SectionField>
          <SectionField label="Upload button text">
            <input
              value={settings.uploadPhoto.buttonText}
              onChange={(e) => update("uploadPhoto", "buttonText", e.target.value)}
              style={inputStyle()}
            />
          </SectionField>
        </>
      );
    }

    if (activeSection === "addonPrice") {
      return (
        <>
          <SectionField label="Display mode">
            <select
              value={settings.addonPrice.displayMode}
              onChange={(e) => update("addonPrice", "displayMode", e.target.value)}
              style={inputStyle()}
            >
              <option value="suffix">Suffix</option>
              <option value="prefix">Prefix</option>
              <option value="inline">Inline</option>
            </select>
          </SectionField>
          <SectionField label="Price prefix">
            <input
              value={settings.addonPrice.prefix}
              onChange={(e) => update("addonPrice", "prefix", e.target.value)}
              style={inputStyle()}
            />
          </SectionField>
          <SectionField label="Decimals">
            <input
              value={settings.addonPrice.decimals}
              onChange={(e) => update("addonPrice", "decimals", Number(e.target.value || 0))}
              style={inputStyle()}
            />
          </SectionField>
        </>
      );
    }

    if (activeSection === "cartSettings") {
      return (
        <>
          <SectionField label="Cart summary">
            <label style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={!!settings.cartSettings.showOptionSummary}
                onChange={(e) => update("cartSettings", "showOptionSummary", e.target.checked)}
              />
              Show option summary
            </label>
            <label style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={!!settings.cartSettings.showTotalPrice}
                onChange={(e) => update("cartSettings", "showTotalPrice", e.target.checked)}
              />
              Show total price
            </label>
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.cartSettings.editInCart}
                onChange={(e) => update("cartSettings", "editInCart", e.target.checked)}
              />
              Allow editing in cart
            </label>
          </SectionField>
        </>
      );
    }

    if (activeSection === "checkoutSettings") {
      return (
        <>
          <SectionField label="Checkout sync">
            <label style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
              <input
                type="checkbox"
                checked={!!settings.checkoutSettings.syncToNote}
                onChange={(e) => update("checkoutSettings", "syncToNote", e.target.checked)}
              />
              Sync options to order note
            </label>
            <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!settings.checkoutSettings.syncToPackingSlip}
                onChange={(e) => update("checkoutSettings", "syncToPackingSlip", e.target.checked)}
              />
              Sync options to packing slip
            </label>
          </SectionField>
        </>
      );
    }

    return (
      <>
        <SectionField label="Advanced features">
          <label style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={!!settings.advancedSettings.conditionalLogic}
              onChange={(e) => update("advancedSettings", "conditionalLogic", e.target.checked)}
            />
            Conditional logic
          </label>
          <label style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={!!settings.advancedSettings.minMaxSelections}
              onChange={(e) => update("advancedSettings", "minMaxSelections", e.target.checked)}
            />
            Min/max selections
          </label>
          <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!settings.advancedSettings.quantitySelector}
              onChange={(e) => update("advancedSettings", "quantitySelector", e.target.checked)}
            />
            Quantity selector
          </label>
        </SectionField>
      </>
    );
  }

  function saveSection() {
    const form = document.getElementById("settings-save-form");
    if (!form) return;
    form.requestSubmit();
  }

  const swatchRadius =
    preview.colorSwatch.shape === "circle"
      ? "999px"
      : preview.colorSwatch.shape === "rounded"
        ? "14px"
        : "4px";

  const imageRadius =
    preview.imageSwatch.shape === "pill"
      ? "999px"
      : preview.imageSwatch.shape === "rounded"
        ? "14px"
        : "6px";

  return (
    <div>
      <div style={{ ...shellCard(), marginBottom: "20px" }}>
        <div style={{ display: "inline-flex", padding: "6px 10px", borderRadius: "999px", background: "#eef2ff", color: "#3730a3", fontSize: "12px", fontWeight: 800, marginBottom: "12px" }}>
          Settings
        </div>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 900, color: "#111827" }}>Settings</h1>
        <p style={{ color: "#6b7280", marginTop: "10px", lineHeight: 1.6 }}>
          Control how your fields behave across the storefront. These settings persist in your app database.
        </p>
      </div>

      <Form id="settings-save-form" method="post">
        <input type="hidden" name="sectionKey" value={activeSection} />
        <input type="hidden" name="sectionJson" value={JSON.stringify(settings[activeSection] || {})} />
      </Form>

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr 460px", gap: "18px", alignItems: "start" }}>
        <div style={shellCard()}>
          <div style={{ display: "grid", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setActiveSection("general")}
              style={{
                ...buttonStyle(false),
                textAlign: "left",
                background: activeSection === "general" ? "#f9fafb" : "#fff",
              }}
            >
              General
            </button>

            {SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                style={{
                  ...buttonStyle(false),
                  textAlign: "left",
                  background: activeSection === section.key ? "#f9fafb" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ width: "20px", opacity: 0.7 }}>{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div style={shellCard()}>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "#111827", marginBottom: "16px" }}>
            {activeSection === "general"
              ? "General"
              : SECTIONS.find((s) => s.key === activeSection)?.label || "Settings"}
          </div>

          {renderSectionEditor()}

          <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            <button type="button" onClick={saveSection} style={buttonStyle(true)}>
              Save section
            </button>
          </div>
        </div>

        <div style={{ ...shellCard(), minHeight: "720px" }}>
          <div style={{ fontSize: "18px", fontWeight: 900, marginBottom: "18px", color: "#111827" }}>Preview</div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>Dropdown list</div>
            <select style={inputStyle()}>
              <option>Select an option</option>
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>Toggle</div>
            <div
              style={{
                width: "42px",
                height: "24px",
                borderRadius: "999px",
                background: preview.toggle.defaultOn ? "#059669" : "#d1d5db",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "3px",
                  left: preview.toggle.defaultOn ? "21px" : "3px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "999px",
                  background: "#fff",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>Radio button</div>
              <label style={{ display: "block", marginBottom: "8px" }}>
                <input type="radio" name="demo-radio" /> Radio 1
              </label>
              <label style={{ display: "block" }}>
                <input type="radio" name="demo-radio" defaultChecked /> Radio 2
              </label>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>Checkbox</div>
              <label style={{ display: "block", marginBottom: "8px" }}>
                <input type="checkbox" defaultChecked /> Checkbox 1
              </label>
              <label style={{ display: "block" }}>
                <input type="checkbox" defaultChecked /> Checkbox 2
              </label>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>Inline button</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" style={{ ...buttonStyle(false), minWidth: "96px" }}>Button 1</button>
              <button type="button" style={{ ...buttonStyle(false), minWidth: "96px", borderColor: "#059669", boxShadow: "inset 0 0 0 1px #059669" }}>Button 2</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>Image swatch</div>
              <div style={{ display: "flex", gap: "10px" }}>
                {["1", "2"].map((n, i) => (
                  <div key={n} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: preview.imageSwatch.size === "large" ? "64px" : preview.imageSwatch.size === "small" ? "40px" : "52px",
                        height: preview.imageSwatch.size === "large" ? "64px" : preview.imageSwatch.size === "small" ? "40px" : "52px",
                        borderRadius: imageRadius,
                        border: i === 0 ? "2px solid #059669" : "1px solid #d1d5db",
                        background: "#f3f4f6",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                      }}
                    >
                      {n}
                    </div>
                    {preview.imageSwatch.showLabel ? <div style={{ fontSize: "13px", marginTop: "8px" }}>Image {n}</div> : null}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>Color swatch</div>
              <div style={{ display: "flex", gap: "12px" }}>
                {["#f6c4cb", "#c9bdf8"].map((color, i) => (
                  <div key={color} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: preview.colorSwatch.size === "large" ? "44px" : preview.colorSwatch.size === "small" ? "26px" : "36px",
                        height: preview.colorSwatch.size === "large" ? "44px" : preview.colorSwatch.size === "small" ? "26px" : "36px",
                        borderRadius: swatchRadius,
                        border:
                          preview.colorSwatch.borderStyle === "none"
                            ? "none"
                            : preview.colorSwatch.borderStyle === "soft"
                              ? "2px solid #f3f4f6"
                              : "1px solid #9ca3af",
                        background: color,
                      }}
                    />
                    {preview.colorSwatch.showLabel ? <div style={{ fontSize: "13px", marginTop: "8px", fontWeight: i === 0 ? 700 : 400 }}>Color {i + 1}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>File upload</div>
            <div style={{ border: "1px dashed #d1d5db", borderRadius: "14px", padding: "16px", textAlign: "center" }}>
              <button type="button" style={buttonStyle(false)}>{preview.uploadPhoto.buttonText}</button>
              <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "10px" }}>
                Accept {preview.uploadPhoto.accept}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px" }}>Quantity</div>
            <div style={{ display: "inline-flex", border: "1px solid #d1d5db", borderRadius: "10px", overflow: "hidden" }}>
              <button type="button" style={{ ...buttonStyle(false), border: "none", borderRight: "1px solid #d1d5db", borderRadius: 0 }}>-</button>
              <div style={{ padding: "10px 16px", minWidth: "48px", textAlign: "center" }}>1</div>
              <button type="button" style={{ ...buttonStyle(false), border: "none", borderLeft: "1px solid #d1d5db", borderRadius: 0 }}>+</button>
            </div>
          </div>

          <button type="button" style={{ ...buttonStyle(false), width: "100%", opacity: 0.65 }}>
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}