import { useEffect, useMemo, useState } from "react";
import { Form, useLoaderData, redirect, useFetcher } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function fieldBaseConfig(type) {
  return {
    showIfField: "",
    showIfValue: "",
    bundleGroup: "",
    flatPrice: "0",
    paragraphText: "",
    headingSize: "h3",
    allowedFileTypes: ".jpg,.jpeg,.png,.pdf,.ai,.eps,.svg",
    maxFileSizeMb: "10",
  };
}

function supportsChoices(type) {
  return ["dropdown", "radio", "checkbox", "image", "color", "bundle"].includes(type);
}

function choiceBase(type, index = 1) {
  return {
    id: Date.now() + Math.random(),
    label: `Choice ${index}`,
    price: "0",
    imageUrl: "",
    colorHex: "#cccccc",
    defaultSelected: false,
    linkedVariantId: "",
  };
}

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function valueMatchesSelection(actualValue, expectedValue) {
  if (!expectedValue) return true;
  const expected = normalizeValue(expectedValue);

  if (Array.isArray(actualValue)) {
    return actualValue.some((item) => normalizeValue(item) === expected);
  }

  return normalizeValue(actualValue) === expected;
}

function isOptionVisible(option, selections) {
  const showIfField = option?.config?.showIfField || "";
  const showIfValue = option?.config?.showIfValue || "";

  if (!showIfField) return true;

  const controllingValue = selections[showIfField];
  return valueMatchesSelection(controllingValue, showIfValue);
}

function getEmptyValueForType(type) {
  return type === "checkbox" ? [] : "";
}

function getDefaultValueForOption(option) {
  if (!supportsChoices(option.type)) {
    return "";
  }

  const defaultChoices = option.choices.filter((choice) => !!choice.defaultSelected);

  if (option.type === "checkbox") {
    return defaultChoices.map((choice) => choice.label);
  }

  return defaultChoices[0]?.label || "";
}

function getDefaultSelections(options) {
  const initial = {};

  options.forEach((option) => {
    initial[option.name] = getDefaultValueForOption(option);
  });

  return initial;
}

function calculatePreviewPrice(basePrice, options, selections) {
  let total = Number(basePrice) || 0;

  options.forEach((option) => {
    if (!isOptionVisible(option, selections)) return;

    const selectedValue = selections[option.name];
    const hasValue = Array.isArray(selectedValue)
      ? selectedValue.length > 0
      : String(selectedValue || "").trim() !== "";

    const fieldFlatPrice = Number(option?.config?.flatPrice || 0);
    if (hasValue && fieldFlatPrice) {
      total += fieldFlatPrice;
    }

    if (!supportsChoices(option.type)) return;

    if (option.type === "checkbox") {
      const selectedArray = Array.isArray(selectedValue) ? selectedValue : [];
      option.choices.forEach((choice) => {
        if (selectedArray.includes(choice.label)) {
          total += Number(choice.price || 0);
        }
      });
      return;
    }

    const foundChoice = option.choices.find((choice) => choice.label === selectedValue);
    if (foundChoice) {
      total += Number(foundChoice.price || 0);
    }
  });

  return total;
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const optionSets = await prisma.optionSet.findMany({
    include: {
      fields: {
        include: {
          choices: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      assignments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const productsResponse = await admin.graphql(`
    #graphql
    query GetProductsAndVariants {
      products(first: 100) {
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                }
              }
            }
          }
        }
      }
    }
  `);

  const productsJson = await productsResponse.json();

  const products = (productsJson?.data?.products?.edges || []).map(({ node }) => ({
    id: node.id.split("/").pop(),
    gid: node.id,
    title: node.title,
    variants: (node.variants?.edges || []).map(({ node: variantNode }) => ({
      id: variantNode.id.split("/").pop(),
      gid: variantNode.id,
      title: variantNode.title,
      price: variantNode.price,
    })),
  }));

  const collectionsResponse = await admin.graphql(`
    #graphql
    query GetCollections {
      collections(first: 100) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  `);

  const collectionsJson = await collectionsResponse.json();

  const collections = (collectionsJson?.data?.collections?.edges || []).map(({ node }) => ({
    id: node.id.split("/").pop(),
    gid: node.id,
    title: node.title,
  }));

  return { optionSets, products, collections };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  const optionSetId = formData.get("optionSetId");
  const optionSetName = formData.get("optionSetName");
  const optionsJson = formData.get("optionsJson");
  const shopifyProductId = formData.get("shopifyProductId");
  const shopifyCollectionGid = formData.get("shopifyCollectionGid");
  const assignmentId = formData.get("assignmentId");

  if (intent === "delete" && optionSetId) {
    await prisma.optionSet.delete({
      where: { id: Number(optionSetId) },
    });
    return redirect("/app/option-sets");
  }

  if (intent === "assignProduct" && optionSetId && shopifyProductId) {
    const extractedId =
      String(shopifyProductId).trim().match(/(\d{8,})$/)?.[1] ||
      String(shopifyProductId).trim();

    await prisma.productOptionSet.upsert({
      where: {
        shopifyProductId: extractedId,
      },
      update: {
        optionSetId: Number(optionSetId),
      },
      create: {
        shopifyProductId: extractedId,
        optionSetId: Number(optionSetId),
      },
    });

    return redirect("/app/option-sets");
  }

  if (intent === "assignCollection" && optionSetId && shopifyCollectionGid) {
    const response = await admin.graphql(
      `
        #graphql
        query GetCollectionProducts($id: ID!) {
          collection(id: $id) {
            id
            title
            products(first: 250) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        }
      `,
      {
        variables: {
          id: String(shopifyCollectionGid),
        },
      }
    );

    const json = await response.json();
    const productEdges = json?.data?.collection?.products?.edges || [];

    for (const edge of productEdges) {
      const numericProductId = edge.node.id.split("/").pop();

      await prisma.productOptionSet.upsert({
        where: {
          shopifyProductId: numericProductId,
        },
        update: {
          optionSetId: Number(optionSetId),
        },
        create: {
          shopifyProductId: numericProductId,
          optionSetId: Number(optionSetId),
        },
      });
    }

    return redirect("/app/option-sets");
  }

  if (intent === "deleteAssignment" && assignmentId) {
    await prisma.productOptionSet.delete({
      where: { id: Number(assignmentId) },
    });
    return redirect("/app/option-sets");
  }

  if (!optionSetName || !optionsJson) {
    return redirect("/app/option-sets");
  }

  const options = JSON.parse(optionsJson);

  const mappedFields = options.map((option, index) => ({
    label: option.name,
    type: option.type,
    isRequired: option.isRequired ?? false,
    sortOrder: index,
    priceMode: Number(option.config?.flatPrice || 0) !== 0 ? "fixed" : "none",
    priceValue: Number(option.config?.flatPrice || 0),
    allowMultiple: option.type === "checkbox",
    helpText: option.helpText || null,
    placeholder: option.placeholder || null,
    configJson: JSON.stringify(option.config || {}),
    choices: option.choices?.length
      ? {
          create: option.choices.map((choice, choiceIndex) => ({
            label: choice.label,
            value: choice.label.toLowerCase().replace(/\s+/g, "_"),
            priceMode: Number(choice.price) !== 0 ? "fixed" : "none",
            priceValue: Number(choice.price) || 0,
            sortOrder: choiceIndex,
            imageUrl: choice.imageUrl || null,
            colorHex: choice.colorHex || null,
            linkedVariantId: choice.linkedVariantId || null,
            configJson: JSON.stringify({
              defaultSelected: !!choice.defaultSelected,
            }),
          })),
        }
      : undefined,
  }));

  if (optionSetId) {
    await prisma.optionSet.update({
      where: { id: Number(optionSetId) },
      data: {
        name: String(optionSetName),
        fields: {
          deleteMany: {},
          create: mappedFields,
        },
      },
    });
  } else {
    await prisma.optionSet.create({
      data: {
        name: String(optionSetName),
        status: "active",
        fields: {
          create: mappedFields,
        },
      },
    });
  }

  return redirect("/app/option-sets");
}

function card() {
  return {
    background: "#ffffff",
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

function primaryButton() {
  return {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function secondaryButton() {
  return {
    padding: "8px 12px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function subtleDangerButton() {
  return {
    padding: "8px 12px",
    borderRadius: "12px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function sectionTitle() {
  return {
    fontWeight: 900,
    marginBottom: "8px",
    color: "#111827",
  };
}

function badge(bg, color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    background: bg,
    color,
  };
}

function pricePillStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#ecfeff",
    color: "#155e75",
    fontWeight: 800,
    fontSize: "12px",
  };
}

function ImagePickerModal({ open, onClose, onPick }) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (open && fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/api/shopify-files");
    }
  }, [open, fetcher]);

  if (!open) return null;

  const files = fetcher.data?.files || [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          maxHeight: "80vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: "20px",
          border: "1px solid #e5e7eb",
          padding: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "16px",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#111827" }}>
              Select Shopify Image
            </div>
            <div style={{ color: "#6b7280", marginTop: "4px" }}>
              Choose an existing file from Shopify.
            </div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButton()}>
            Close
          </button>
        </div>

        {fetcher.state !== "idle" && !fetcher.data ? (
          <div style={{ color: "#6b7280" }}>Loading Shopify files...</div>
        ) : files.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No Shopify images found.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => {
                  onPick(file.url);
                  onClose();
                }}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "10px",
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#f3f4f6",
                    marginBottom: "10px",
                  }}
                >
                  <img
                    src={file.url}
                    alt={file.alt || "Shopify file"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#111827",
                    wordBreak: "break-word",
                  }}
                >
                  {file.alt || "Shopify image"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClearSelectionButton({ option, onClear }) {
  if (option.isRequired) return null;

  return (
    <button
      type="button"
      onClick={onClear}
      style={{ ...secondaryButton(), padding: "6px 10px", fontSize: "12px" }}
    >
      Clear selection
    </button>
  );
}

function PreviewField({ option, value, onChange }) {
  const canClearSingleSelect =
    !option.isRequired && ["dropdown", "radio", "image", "color", "bundle"].includes(option.type);
  const hasSelectedValue = Array.isArray(value) ? value.length > 0 : String(value || "").trim() !== "";

  if (option.type === "heading") {
    const Tag =
      option.config?.headingSize === "h1"
        ? "h1"
        : option.config?.headingSize === "h2"
          ? "h2"
          : option.config?.headingSize === "h4"
            ? "h4"
            : "h3";

    return (
      <Tag style={{ margin: "0 0 8px", color: "#111827" }}>
        {option.config?.paragraphText || option.name}
      </Tag>
    );
  }

  if (option.type === "paragraph") {
    return (
      <p style={{ margin: "0 0 12px", color: "#4b5563", lineHeight: 1.6 }}>
        {option.config?.paragraphText || option.placeholder || option.helpText || option.name}
      </p>
    );
  }

  return (
    <div style={{ marginBottom: "18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "6px",
        }}
      >
        <label style={{ display: "block", fontWeight: 800, color: "#111827" }}>
          {option.name} {option.isRequired ? "*" : ""}
        </label>

        {canClearSingleSelect && hasSelectedValue ? (
          <ClearSelectionButton option={option} onClear={() => onChange(getEmptyValueForType(option.type))} />
        ) : null}
      </div>

      {option.helpText ? (
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>
          {option.helpText}
        </div>
      ) : null}

      {option.type === "text" && (
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={option.placeholder || ""}
          style={inputStyle()}
        />
      )}

      {option.type === "textarea" && (
        <textarea
          rows="4"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={option.placeholder || ""}
          style={inputStyle()}
        />
      )}

      {option.type === "number" && (
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={option.placeholder || ""}
          style={inputStyle()}
        />
      )}

      {option.type === "date" && (
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle()}
        />
      )}

      {option.type === "time" && (
        <input
          type="time"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle()}
        />
      )}

      {option.type === "file_upload" && (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            borderRadius: "14px",
            padding: "14px",
            background: "#f8fafc",
          }}
        >
          <input type="file" style={{ width: "100%" }} />
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
            Allowed: {option.config?.allowedFileTypes || "Any"} • Max {option.config?.maxFileSizeMb || "10"} MB
          </div>
        </div>
      )}

      {option.type === "dropdown" && (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle()}
        >
          <option value="">{option.isRequired ? "Select an option" : "None selected"}</option>
          {option.choices.map((choice) => (
            <option key={choice.id} value={choice.label}>
              {choice.label}
              {Number(choice.price || 0) ? ` (+$${Number(choice.price || 0).toFixed(2)})` : ""}
            </option>
          ))}
        </select>
      )}

      {option.type === "radio" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {option.choices.map((choice) => {
            const checked = value === choice.label;

            return (
              <label
                key={choice.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  background: checked ? "#f9fafb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`preview-${option.id}`}
                  checked={checked}
                  onChange={() => {}}
                  onClick={() => {
                    if (checked && !option.isRequired) {
                      onChange("");
                    } else if (!checked) {
                      onChange(choice.label);
                    }
                  }}
                />
                <span style={{ flex: 1 }}>{choice.label}</span>
                {Number(choice.price || 0) ? (
                  <span style={pricePillStyle()}>+${Number(choice.price || 0).toFixed(2)}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}

      {option.type === "checkbox" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {option.choices.map((choice) => {
            const current = Array.isArray(value) ? value : [];
            const checked = current.includes(choice.label);

            return (
              <label
                key={choice.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  background: checked ? "#f9fafb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...current, choice.label]);
                    } else {
                      onChange(current.filter((item) => item !== choice.label));
                    }
                  }}
                />
                <span style={{ flex: 1 }}>{choice.label}</span>
                {Number(choice.price || 0) ? (
                  <span style={pricePillStyle()}>+${Number(choice.price || 0).toFixed(2)}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}

      {option.type === "image" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "10px",
          }}
        >
          {option.choices.map((choice) => {
            const selected = value === choice.label;

            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => {
                  if (selected && !option.isRequired) {
                    onChange("");
                  } else if (!selected) {
                    onChange(choice.label);
                  }
                }}
                style={{
                  border: selected ? "2px solid #111827" : "1px solid #d1d5db",
                  borderRadius: "14px",
                  padding: "8px",
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: "10px",
                    background: choice.imageUrl
                      ? `url(${choice.imageUrl}) center/cover no-repeat`
                      : "#f3f4f6",
                    marginBottom: "8px",
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#111827" }}>
                  {choice.label}
                </div>
                {Number(choice.price || 0) ? (
                  <div style={{ fontSize: "12px", color: "#0f766e", marginTop: "4px", fontWeight: 700 }}>
                    +${Number(choice.price || 0).toFixed(2)}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {option.type === "color" && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {option.choices.map((choice) => {
            const selected = value === choice.label;

            return (
              <button
                key={choice.id}
                type="button"
                title={choice.label}
                onClick={() => {
                  if (selected && !option.isRequired) {
                    onChange("");
                  } else if (!selected) {
                    onChange(choice.label);
                  }
                }}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  border: selected ? "3px solid #111827" : "1px solid #d1d5db",
                  background: choice.colorHex || "#cccccc",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      )}

      {option.type === "bundle" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {option.choices.map((choice) => {
            const checked = value === choice.label;

            return (
              <label
                key={choice.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  background: checked ? "#f9fafb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`preview-bundle-${option.id}`}
                  checked={checked}
                  onChange={() => {}}
                  onClick={() => {
                    if (checked && !option.isRequired) {
                      onChange("");
                    } else if (!checked) {
                      onChange(choice.label);
                    }
                  }}
                />
                <span style={{ flex: 1 }}>{choice.label}</span>
                {Number(choice.price || 0) ? (
                  <span style={pricePillStyle()}>+${Number(choice.price || 0).toFixed(2)}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LivePreview({ optionSetName, options, selections, setSelections, basePrice, setBasePrice }) {
  const visibleOptions = useMemo(
    () => options.filter((option) => isOptionVisible(option, selections)),
    [options, selections]
  );

  const totalPrice = useMemo(
    () => calculatePreviewPrice(basePrice, options, selections),
    [basePrice, options, selections]
  );

  useEffect(() => {
    const visibleNames = new Set(visibleOptions.map((option) => option.name));

    setSelections((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.keys(next).forEach((key) => {
        if (!visibleNames.has(key)) {
          const relatedOption = options.find((option) => option.name === key);
          const emptyValue = getEmptyValueForType(relatedOption?.type || "");
          const currentValue = next[key];

          const needsReset = Array.isArray(currentValue)
            ? currentValue.length > 0
            : String(currentValue || "").trim() !== "";

          if (needsReset) {
            next[key] = emptyValue;
            changed = true;
          }
        }
      });

      return changed ? next : prev;
    });
  }, [visibleOptions, options, setSelections]);

  return (
    <div style={{ position: "sticky", top: "20px" }}>
      <div style={card()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "flex-start",
            marginBottom: "18px",
          }}
        >
          <div>
            <div style={{ ...badge("#eef2ff", "#3730a3"), marginBottom: "12px" }}>Live Preview</div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
              Simulated Product Page
            </div>
            <div style={{ color: "#6b7280", marginTop: "8px", lineHeight: 1.6 }}>
              This updates instantly as you build fields, choices, conditions, pricing, and linked add-on variants.
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "20px",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              minHeight: "300px",
            }}
          >
            <div
              style={{
                background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
                borderRight: "1px solid #e5e7eb",
                padding: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  aspectRatio: "1 / 1",
                  borderRadius: "20px",
                  border: "1px solid #dbeafe",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontWeight: 800,
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Product image area
                <br />
                preview mock
              </div>
            </div>

            <div style={{ padding: "24px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                  marginBottom: "8px",
                }}
              >
                PRODUCT
              </div>

              <h2 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 900, color: "#111827" }}>
                {optionSetName || "New Option Set"}
              </h2>

              <div style={{ color: "#6b7280", marginBottom: "16px", lineHeight: 1.6 }}>
                Live storefront-style preview of the options your customer will see.
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "18px",
                }}
              >
                <div style={{ fontSize: "30px", fontWeight: 900, color: "#111827" }}>
                  ${totalPrice.toFixed(2)}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 800 }}>Base Price</span>
                  <input
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    style={{ ...inputStyle(), width: "120px", padding: "8px 10px" }}
                  />
                </div>
              </div>

              {visibleOptions.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: "16px",
                    padding: "20px",
                    color: "#64748b",
                    background: "#f8fafc",
                  }}
                >
                  Add fields on the left and they’ll appear here in real time.
                </div>
              ) : (
                <div>
                  {visibleOptions.map((option) => (
                    <PreviewField
                      key={option.id}
                      option={option}
                      value={selections[option.name]}
                      onChange={(nextValue) =>
                        setSelections((prev) => ({
                          ...prev,
                          [option.name]: nextValue,
                        }))
                      }
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                style={{
                  marginTop: "10px",
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "none",
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  fontSize: "15px",
                }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "16px",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "14px",
            background: "#f9fafb",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111827", marginBottom: "8px" }}>
            Live Selection Snapshot
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#374151",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {JSON.stringify(selections, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function OptionSetsPage() {
  const { optionSets, products, collections } = useLoaderData();

  const [editingId, setEditingId] = useState("");
  const [optionSetName, setOptionSetName] = useState("New Option Set");
  const [optionName, setOptionName] = useState("");
  const [fieldType, setFieldType] = useState("dropdown");
  const [options, setOptions] = useState([]);
  const [productInputs, setProductInputs] = useState({});
  const [collectionInputs, setCollectionInputs] = useState({});
  const [pickerTarget, setPickerTarget] = useState(null);
  const [basePrice, setBasePrice] = useState("99.00");
  const [previewSelections, setPreviewSelections] = useState({});

  const productTitleMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.title])),
    [products]
  );

  const variantOptions = useMemo(() => {
    const output = [];

    products.forEach((product) => {
      (product.variants || []).forEach((variant) => {
        output.push({
          id: variant.id,
          label: `${product.title} → ${variant.title} (${variant.price})`,
        });
      });
    });

    return output;
  }, [products]);

  useEffect(() => {
    setPreviewSelections((prev) => {
      const next = {};
      let changed = false;

      options.forEach((option) => {
        const existing = prev[option.name];

        if (existing !== undefined) {
          next[option.name] = existing;
          return;
        }

        next[option.name] = getDefaultValueForOption(option);
        changed = true;
      });

      if (Object.keys(prev).length !== options.length) {
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [options]);

  function addOption() {
    if (!optionName.trim()) return;

    const type = fieldType;
    const base = {
      id: Date.now() + Math.random(),
      name: optionName,
      type,
      isRequired: false,
      helpText: "",
      placeholder: "",
      config: fieldBaseConfig(type),
      choices: supportsChoices(type) ? [choiceBase(type, 1), choiceBase(type, 2)] : [],
    };

    if (type === "color") {
      base.choices[0].colorHex = "#ff0000";
      base.choices[1].colorHex = "#0000ff";
    }

    setOptions((prev) => [...prev, base]);
    setOptionName("");
    setFieldType("dropdown");
  }

  function loadSet(set) {
    const loadedOptions = set.fields.map((field) => {
      const config = parseJson(field.configJson, fieldBaseConfig(field.type));
      return {
        id: Date.now() + Math.random(),
        name: field.label,
        type: field.type,
        isRequired: field.isRequired ?? false,
        helpText: field.helpText || "",
        placeholder: field.placeholder || "",
        config,
        choices: field.choices.map((choice) => {
          const choiceConfig = parseJson(choice.configJson, {});
          return {
            id: Date.now() + Math.random(),
            label: choice.label,
            price: String(choice.priceValue ?? 0),
            imageUrl: choice.imageUrl || "",
            colorHex: choice.colorHex || "#cccccc",
            defaultSelected: !!choiceConfig.defaultSelected,
            linkedVariantId: choice.linkedVariantId || "",
          };
        }),
      };
    });

    setEditingId(String(set.id));
    setOptionSetName(set.name);
    setOptions(loadedOptions);
    setPreviewSelections(getDefaultSelections(loadedOptions));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearBuilder() {
    setEditingId("");
    setOptionSetName("New Option Set");
    setOptionName("");
    setFieldType("dropdown");
    setOptions([]);
    setPreviewSelections({});
    setBasePrice("99.00");
  }

  function moveOptionUp(index) {
    if (index === 0) return;
    const updated = [...options];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setOptions(updated);
  }

  function moveOptionDown(index) {
    if (index === options.length - 1) return;
    const updated = [...options];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setOptions(updated);
  }

  function deleteOption(id) {
    const optionToDelete = options.find((o) => o.id === id);
    setOptions((prev) => prev.filter((o) => o.id !== id));

    if (optionToDelete) {
      setPreviewSelections((prev) => {
        const next = { ...prev };
        delete next[optionToDelete.name];
        return next;
      });
    }
  }

  function toggleRequired(optionId) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId ? { ...option, isRequired: !option.isRequired } : option
      )
    );
  }

  function updateChoice(optionId, choiceId, field, value) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? {
              ...option,
              choices: option.choices.map((choice) =>
                choice.id === choiceId ? { ...choice, [field]: value } : choice
              ),
            }
          : option
      )
    );
  }

  function addChoice(optionId, type) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? {
              ...option,
              choices: [...option.choices, choiceBase(type, option.choices.length + 1)],
            }
          : option
      )
    );
  }

  function deleteChoice(optionId, choiceId) {
    setOptions((prev) =>
      prev.map((option) => {
        if (option.id !== optionId) return option;

        const updatedChoices = option.choices.filter((choice) => choice.id !== choiceId);
        const removedChoice = option.choices.find((choice) => choice.id === choiceId);

        if (removedChoice) {
          setPreviewSelections((prevSelections) => {
            const currentValue = prevSelections[option.name];
            const nextSelections = { ...prevSelections };

            if (option.type === "checkbox") {
              const currentArray = Array.isArray(currentValue) ? currentValue : [];
              nextSelections[option.name] = currentArray.filter((item) => item !== removedChoice.label);
            } else if (currentValue === removedChoice.label) {
              nextSelections[option.name] = "";
            }

            return nextSelections;
          });
        }

        return {
          ...option,
          choices: updatedChoices,
        };
      })
    );
  }

  function updateOptionField(optionId, field, value) {
    const existing = options.find((option) => option.id === optionId);

    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId ? { ...option, [field]: value } : option
      )
    );

    if (field === "name" && existing && existing.name !== value) {
      setPreviewSelections((prev) => {
        const next = { ...prev };

        if (Object.prototype.hasOwnProperty.call(next, existing.name)) {
          next[value] = next[existing.name];
          delete next[existing.name];
        }

        return next;
      });
    }
  }

  function updateOptionConfig(optionId, field, value) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? {
              ...option,
              config: {
                ...option.config,
                [field]: value,
              },
            }
          : option
      )
    );
  }

  async function uploadChoiceImage(file, optionId, choiceId) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.ok && data.url) {
      updateChoice(optionId, choiceId, "imageUrl", data.url);
    } else {
      alert(data.error || "Upload failed");
    }
  }

  return (
    <div>
      <ImagePickerModal
        open={!!pickerTarget}
        onClose={() => setPickerTarget(null)}
        onPick={(url) => {
          if (!pickerTarget) return;
          updateChoice(pickerTarget.optionId, pickerTarget.choiceId, "imageUrl", url);
        }}
      />

      <div style={{ ...card(), marginBottom: "20px" }}>
        <div style={{ ...badge("#eef2ff", "#3730a3"), marginBottom: "12px" }}>
          Option Sets
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "34px", color: "#111827", fontWeight: 900 }}>
              Option Set Builder
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                color: "#6b7280",
                lineHeight: 1.6,
                maxWidth: "900px",
              }}
            >
              Build fields on the left, preview them on the right, and link priced choices to real Shopify add-on variants for checkout charging.
            </p>
          </div>

          <button type="button" onClick={clearBuilder} style={secondaryButton()}>
            New Set
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(380px, 0.95fr)",
          gap: "20px",
          alignItems: "start",
          marginBottom: "20px",
        }}
      >
        <div style={card()}>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#111827", marginBottom: "6px" }}>
            {editingId ? "Edit Option Set" : "Create Option Set"}
          </div>
          <div style={{ color: "#6b7280", marginBottom: "18px" }}>
            Build the option set once, then assign it to products or collections.
          </div>

          <Form method="post">
            <input type="hidden" name="optionSetId" value={editingId} />
            <input type="hidden" name="optionsJson" value={JSON.stringify(options)} />

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>
                Option Set Name
              </label>
              <input
                name="optionSetName"
                value={optionSetName}
                onChange={(e) => setOptionSetName(e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 220px auto",
                gap: "10px",
                alignItems: "end",
                marginBottom: "18px",
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>
                  Field Label
                </label>
                <input
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                  placeholder="e.g. Logo Upload, Gift Box, Ribbon Color"
                  style={inputStyle()}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>
                  Field Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  style={inputStyle()}
                >
                  <option value="dropdown">Dropdown</option>
                  <option value="radio">Radio Buttons</option>
                  <option value="checkbox">Checkboxes</option>
                  <option value="text">Single Line Text</option>
                  <option value="textarea">Multi Line Text</option>
                  <option value="image">Image Swatch</option>
                  <option value="color">Color Swatch</option>
                  <option value="file_upload">File Upload</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="time">Time</option>
                  <option value="heading">Heading</option>
                  <option value="paragraph">Paragraph</option>
                  <option value="bundle">Bundle Group</option>
                </select>
              </div>

              <button type="button" onClick={addOption} style={primaryButton()}>
                + Add Field
              </button>
            </div>

            <div style={{ marginBottom: options.length ? "20px" : 0 }}>
              <button type="submit" style={primaryButton()}>
                {editingId ? "Update Option Set" : "Save Option Set"}
              </button>
            </div>
          </Form>

          {options.length === 0 ? (
            <p style={{ color: "#6b7280", margin: 0 }}>No fields added yet.</p>
          ) : (
            options.map((option, index) => (
              <div
                key={option.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "18px",
                  padding: "16px",
                  marginBottom: "12px",
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, color: "#111827", fontSize: "18px" }}>
                      {option.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>{option.type}</div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => moveOptionUp(index)} style={secondaryButton()}>
                      ↑
                    </button>
                    <button type="button" onClick={() => moveOptionDown(index)} style={secondaryButton()}>
                      ↓
                    </button>
                    <button type="button" onClick={() => toggleRequired(option.id)} style={secondaryButton()}>
                      {option.isRequired ? "Required" : "Optional"}
                    </button>
                    <button type="button" onClick={() => deleteOption(option.id)} style={subtleDangerButton()}>
                      Delete
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Field Label</label>
                    <input
                      value={option.name}
                      onChange={(e) => updateOptionField(option.id, "name", e.target.value)}
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Placeholder / Text</label>
                    <input
                      value={option.placeholder}
                      onChange={(e) => updateOptionField(option.id, "placeholder", e.target.value)}
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Help Text</label>
                    <input
                      value={option.helpText}
                      onChange={(e) => updateOptionField(option.id, "helpText", e.target.value)}
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Flat Field Price</label>
                    <input
                      value={option.config.flatPrice}
                      onChange={(e) => updateOptionConfig(option.id, "flatPrice", e.target.value)}
                      style={inputStyle()}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Show If Field</label>
                    <select
                      value={option.config.showIfField}
                      onChange={(e) => updateOptionConfig(option.id, "showIfField", e.target.value)}
                      style={inputStyle()}
                    >
                      <option value="">Always show</option>
                      {options
                        .filter((o) => o.id !== option.id)
                        .map((o) => (
                          <option key={o.id} value={o.name}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Show If Value</label>
                    <input
                      value={option.config.showIfValue}
                      onChange={(e) => updateOptionConfig(option.id, "showIfValue", e.target.value)}
                      style={inputStyle()}
                      placeholder="Choice label or value"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Bundle Group</label>
                    <input
                      value={option.config.bundleGroup}
                      onChange={(e) => updateOptionConfig(option.id, "bundleGroup", e.target.value)}
                      style={inputStyle()}
                      placeholder="e.g. Premium Bundle"
                    />
                  </div>

                  {(option.type === "heading" || option.type === "paragraph") && (
                    <div>
                      <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Display Text</label>
                      <input
                        value={option.config.paragraphText}
                        onChange={(e) => updateOptionConfig(option.id, "paragraphText", e.target.value)}
                        style={inputStyle()}
                      />
                    </div>
                  )}
                </div>

                {option.type === "file_upload" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Allowed File Types</label>
                      <input
                        value={option.config.allowedFileTypes || ""}
                        onChange={(e) => updateOptionConfig(option.id, "allowedFileTypes", e.target.value)}
                        style={inputStyle()}
                        placeholder=".jpg,.png,.pdf,.svg"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Max File Size (MB)</label>
                      <input
                        value={option.config.maxFileSizeMb || ""}
                        onChange={(e) => updateOptionConfig(option.id, "maxFileSizeMb", e.target.value)}
                        style={inputStyle()}
                        placeholder="10"
                      />
                    </div>
                  </div>
                )}

                {supportsChoices(option.type) && (
                  <div>
                    <div style={sectionTitle()}>Choices</div>

                    {option.choices.map((choice) => (
                      <div
                        key={choice.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "14px",
                          padding: "12px",
                          marginBottom: "10px",
                          background: "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 120px 120px",
                            gap: "10px",
                            alignItems: "end",
                            marginBottom: "12px",
                          }}
                        >
                          <div>
                            <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Choice Label</label>
                            <input
                              value={choice.label}
                              onChange={(e) => updateChoice(option.id, choice.id, "label", e.target.value)}
                              style={inputStyle()}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Add-on Price</label>
                            <input
                              value={choice.price}
                              onChange={(e) => updateChoice(option.id, choice.id, "price", e.target.value)}
                              style={inputStyle()}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Default</label>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                height: "42px",
                                paddingLeft: "4px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!choice.defaultSelected}
                                onChange={(e) =>
                                  updateChoice(option.id, choice.id, "defaultSelected", e.target.checked)
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>
                            Linked Shopify add-on variant
                          </label>
                          <select
                            value={choice.linkedVariantId || ""}
                            onChange={(e) => updateChoice(option.id, choice.id, "linkedVariantId", e.target.value)}
                            style={inputStyle()}
                          >
                            <option value="">No linked variant</option>
                            {variantOptions.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.label}
                              </option>
                            ))}
                          </select>
                          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
                            If this choice has a price and a linked variant, the storefront will add that variant to cart for real checkout charging.
                          </div>
                        </div>

                        {option.type === "image" && (
                          <>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 180px",
                                gap: "12px",
                                alignItems: "start",
                                marginBottom: "12px",
                              }}
                            >
                              <div>
                                <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Image URL</label>
                                <input
                                  value={choice.imageUrl}
                                  onChange={(e) => updateChoice(option.id, choice.id, "imageUrl", e.target.value)}
                                  style={inputStyle()}
                                  placeholder="https://..."
                                />
                              </div>

                              <div>
                                <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Preview</label>
                                <div
                                  style={{
                                    width: "100%",
                                    aspectRatio: "1 / 1",
                                    borderRadius: "14px",
                                    border: "1px solid #d1d5db",
                                    background: choice.imageUrl
                                      ? `url(${choice.imageUrl}) center/cover no-repeat`
                                      : "#f3f4f6",
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                              <button
                                type="button"
                                onClick={() => setPickerTarget({ optionId: option.id, choiceId: choice.id })}
                                style={secondaryButton()}
                              >
                                Select Shopify Image
                              </button>

                              <label
                                style={{
                                  ...secondaryButton(),
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                Upload Image
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    await uploadChoiceImage(file, option.id, choice.id);
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => updateChoice(option.id, choice.id, "imageUrl", "")}
                                style={subtleDangerButton()}
                              >
                                Clear Image
                              </button>
                            </div>
                          </>
                        )}

                        {option.type === "color" && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "120px 1fr 120px",
                              gap: "12px",
                              alignItems: "end",
                              marginBottom: "8px",
                            }}
                          >
                            <div>
                              <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Color Picker</label>
                              <input
                                type="color"
                                value={choice.colorHex || "#cccccc"}
                                onChange={(e) => updateChoice(option.id, choice.id, "colorHex", e.target.value)}
                                style={{
                                  width: "100%",
                                  height: "42px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "12px",
                                  background: "#fff",
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Hex Value</label>
                              <input
                                value={choice.colorHex}
                                onChange={(e) => updateChoice(option.id, choice.id, "colorHex", e.target.value)}
                                style={inputStyle()}
                                placeholder="#000000"
                              />
                            </div>

                            <div>
                              <label style={{ display: "block", fontWeight: 800, marginBottom: "6px" }}>Preview</label>
                              <div
                                style={{
                                  width: "100%",
                                  height: "42px",
                                  borderRadius: "12px",
                                  border: "1px solid #d1d5db",
                                  background: choice.colorHex || "#cccccc",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteChoice(option.id, choice.id)}
                          style={subtleDangerButton()}
                        >
                          Delete Choice
                        </button>
                      </div>
                    ))}

                    <button type="button" onClick={() => addChoice(option.id, option.type)} style={secondaryButton()}>
                      + Add Choice
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <LivePreview
          optionSetName={optionSetName}
          options={options}
          selections={previewSelections}
          setSelections={setPreviewSelections}
          basePrice={basePrice}
          setBasePrice={setBasePrice}
        />
      </div>

      <div style={card()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "center",
            marginBottom: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#111827" }}>Saved Option Sets</div>
            <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
              Assign sets to products or collections, then edit or delete them.
            </div>
          </div>

          <div style={badge("#ecfeff", "#155e75")}>
            {optionSets.length} Total
          </div>
        </div>

        {optionSets.length === 0 ? (
          <p style={{ color: "#6b7280", margin: 0 }}>No option sets yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "16px",
            }}
          >
            {optionSets.map((set) => (
              <div
                key={set.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "18px",
                  padding: "16px",
                  background: "#fff",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 900, color: "#111827", fontSize: "18px" }}>
                    {set.name}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "6px" }}>
                    {set.fields.length} fields • {set.assignments.length} assigned
                  </div>
                </div>

                <Form method="post" style={{ marginBottom: "10px" }}>
                  <input type="hidden" name="intent" value="assignProduct" />
                  <input type="hidden" name="optionSetId" value={set.id} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      name="shopifyProductId"
                      value={productInputs[set.id] || ""}
                      onChange={(e) =>
                        setProductInputs((prev) => ({ ...prev, [set.id]: e.target.value }))
                      }
                      style={{ ...inputStyle(), flex: 1 }}
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title}
                        </option>
                      ))}
                    </select>
                    <button type="submit" style={primaryButton()}>
                      Add
                    </button>
                  </div>
                </Form>

                <Form method="post" style={{ marginBottom: "12px" }}>
                  <input type="hidden" name="intent" value="assignCollection" />
                  <input type="hidden" name="optionSetId" value={set.id} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      name="shopifyCollectionGid"
                      value={collectionInputs[set.id] || ""}
                      onChange={(e) =>
                        setCollectionInputs((prev) => ({ ...prev, [set.id]: e.target.value }))
                      }
                      style={{ ...inputStyle(), flex: 1 }}
                    >
                      <option value="">Select collection</option>
                      {collections.map((collection) => (
                        <option key={collection.gid} value={collection.gid}>
                          {collection.title}
                        </option>
                      ))}
                    </select>
                    <button type="submit" style={primaryButton()}>
                      Add
                    </button>
                  </div>
                </Form>

                {set.assignments.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#9ca3af",
                        marginBottom: "6px",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                      }}
                    >
                      ASSIGNED
                    </div>

                    {set.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "13px",
                          marginBottom: "6px",
                          gap: "10px",
                        }}
                      >
                        <span style={{ color: "#374151" }}>
                          {productTitleMap[assignment.shopifyProductId] ||
                            `ID: ${assignment.shopifyProductId}`}
                        </span>

                        <Form method="post">
                          <input type="hidden" name="intent" value="deleteAssignment" />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <button
                            type="submit"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#dc2626",
                              cursor: "pointer",
                              fontWeight: 800,
                            }}
                          >
                            ✕
                          </button>
                        </Form>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => loadSet(set)}
                    style={{ ...secondaryButton(), flex: 1 }}
                  >
                    Edit
                  </button>

                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="optionSetId" value={set.id} />
                    <button
                      type="submit"
                      style={{ ...primaryButton(), background: "#dc2626" }}
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}