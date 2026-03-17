import { useMemo, useState } from "react";
import { Form, useLoaderData, redirect } from "react-router";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

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
  };
}

function supportsChoices(type) {
  return ["dropdown", "radio", "checkbox", "image", "color", "bundle"].includes(type);
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
    query GetProducts {
      products(first: 100) {
        edges {
          node {
            id
            title
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
    return redirect("/app");
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

    return redirect("/app");
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

    return redirect("/app");
  }

  if (intent === "deleteAssignment" && assignmentId) {
    await prisma.productOptionSet.delete({
      where: { id: Number(assignmentId) },
    });
    return redirect("/app");
  }

  if (!optionSetName || !optionsJson) {
    return redirect("/app");
  }

  const options = JSON.parse(optionsJson);

  const mappedFields = options.map((option, index) => ({
    label: option.name,
    type: option.type,
    isRequired: option.isRequired ?? false,
    sortOrder: index,
    priceMode: "none",
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

  return redirect("/app");
}

function card() {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
  };
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    background: "#fff",
  };
}

function primaryButton() {
  return {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function secondaryButton() {
  return {
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function Index() {
  const { optionSets, products, collections } = useLoaderData();

  const [editingId, setEditingId] = useState("");
  const [optionSetName, setOptionSetName] = useState("New Option Set");
  const [optionName, setOptionName] = useState("");
  const [fieldType, setFieldType] = useState("dropdown");
  const [options, setOptions] = useState([]);
  const [productInputs, setProductInputs] = useState({});
  const [collectionInputs, setCollectionInputs] = useState({});

  const productTitleMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.title])),
    [products]
  );

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
      choices: supportsChoices(type)
        ? [
            {
              id: Date.now() + Math.random() + 1,
              label: "Choice 1",
              price: "0",
              imageUrl: "",
              colorHex: "#cccccc",
              defaultSelected: false,
            },
            {
              id: Date.now() + Math.random() + 2,
              label: "Choice 2",
              price: "0",
              imageUrl: "",
              colorHex: "#999999",
              defaultSelected: false,
            },
          ]
        : [],
    };

    setOptions((prev) => [...prev, base]);
    setOptionName("");
    setFieldType("dropdown");
  }

  function loadSet(set) {
    setEditingId(String(set.id));
    setOptionSetName(set.name);
    setOptions(
      set.fields.map((field) => {
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
            };
          }),
        };
      })
    );
  }

  function clearBuilder() {
    setEditingId("");
    setOptionSetName("New Option Set");
    setOptionName("");
    setFieldType("dropdown");
    setOptions([]);
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
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  function toggleRequired(optionId) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? { ...option, isRequired: !option.isRequired }
          : option
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

  function addChoice(optionId) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? {
              ...option,
              choices: [
                ...option.choices,
                {
                  id: Date.now() + Math.random(),
                  label: `Choice ${option.choices.length + 1}`,
                  price: "0",
                  imageUrl: "",
                  colorHex: "#cccccc",
                  defaultSelected: false,
                },
              ],
            }
          : option
      )
    );
  }

  function deleteChoice(optionId, choiceId) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? {
              ...option,
              choices: option.choices.filter((choice) => choice.id !== choiceId),
            }
          : option
      )
    );
  }

  function updateOptionField(optionId, field, value) {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === optionId ? { ...option, [field]: value } : option
      )
    );
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

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", color: "#111827" }}>Dashboard</h1>
        <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
          Build product options, set per-choice add-on pricing, add conditions, file uploads, and bundle groups.
        </p>
      </div>

      <div style={{ ...card(), marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>Option Builder</div>
            <div style={{ color: "#6b7280", fontSize: "13px" }}>
              One builder for pricing, conditions, uploads, and bundles.
            </div>
          </div>
          <button type="button" onClick={clearBuilder} style={secondaryButton()}>
            New Set
          </button>
        </div>

        <Form method="post" style={{ marginTop: "18px" }}>
          <input type="hidden" name="optionSetId" value={editingId} />
          <input type="hidden" name="optionsJson" value={JSON.stringify(options)} />

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Option Set Name</label>
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
              <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Field label</label>
              <input
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                placeholder="e.g. Gift Box Upgrade"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Field type</label>
              <select value={fieldType} onChange={(e) => setFieldType(e.target.value)} style={inputStyle()}>
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

          <div style={{ marginBottom: "18px" }}>
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
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "12px",
                background: "#f9fafb",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{option.name}</div>
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
                  <button type="button" onClick={() => deleteOption(option.id)} style={{ ...secondaryButton(), color: "#b91c1c" }}>
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
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Help text</label>
                  <input
                    value={option.helpText}
                    onChange={(e) => updateOptionField(option.id, "helpText", e.target.value)}
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Placeholder / Text</label>
                  <input
                    value={option.placeholder}
                    onChange={(e) => updateOptionField(option.id, "placeholder", e.target.value)}
                    style={inputStyle()}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Show if field</label>
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
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Show if value</label>
                  <input
                    value={option.config.showIfValue}
                    onChange={(e) => updateOptionConfig(option.id, "showIfValue", e.target.value)}
                    style={inputStyle()}
                    placeholder="Choice label or value"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Bundle group</label>
                  <input
                    value={option.config.bundleGroup}
                    onChange={(e) => updateOptionConfig(option.id, "bundleGroup", e.target.value)}
                    style={inputStyle()}
                    placeholder="e.g. Luxury Bundle"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Flat field price</label>
                  <input
                    value={option.config.flatPrice}
                    onChange={(e) => updateOptionConfig(option.id, "flatPrice", e.target.value)}
                    style={inputStyle()}
                    placeholder="0"
                  />
                </div>
              </div>

              {(option.type === "heading" || option.type === "paragraph") && (
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Display text</label>
                  <textarea
                    rows="3"
                    value={option.config.paragraphText}
                    onChange={(e) => updateOptionConfig(option.id, "paragraphText", e.target.value)}
                    style={inputStyle()}
                  />
                </div>
              )}

              {supportsChoices(option.type) && (
                <div>
                  <div style={{ fontWeight: 800, marginBottom: "8px", color: "#111827" }}>Choices</div>

                  {option.choices.map((choice) => (
                    <div
                      key={choice.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "12px",
                        marginBottom: "8px",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: option.type === "image" || option.type === "color"
                            ? "1fr 120px 1fr 1fr auto"
                            : "1fr 120px auto",
                          gap: "10px",
                          alignItems: "end",
                        }}
                      >
                        <div>
                          <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Choice label</label>
                          <input
                            value={choice.label}
                            onChange={(e) => updateChoice(option.id, choice.id, "label", e.target.value)}
                            style={inputStyle()}
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Add-on price</label>
                          <input
                            value={choice.price}
                            onChange={(e) => updateChoice(option.id, choice.id, "price", e.target.value)}
                            style={inputStyle()}
                          />
                        </div>

                        {option.type === "image" && (
                          <div>
                            <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Image URL</label>
                            <input
                              value={choice.imageUrl}
                              onChange={(e) => updateChoice(option.id, choice.id, "imageUrl", e.target.value)}
                              style={inputStyle()}
                            />
                          </div>
                        )}

                        {option.type === "color" && (
                          <div>
                            <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Color Hex</label>
                            <input
                              value={choice.colorHex}
                              onChange={(e) => updateChoice(option.id, choice.id, "colorHex", e.target.value)}
                              style={inputStyle()}
                            />
                          </div>
                        )}

                        <div>
                          <label style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Default</label>
                          <input
                            type="checkbox"
                            checked={!!choice.defaultSelected}
                            onChange={(e) => updateChoice(option.id, choice.id, "defaultSelected", e.target.checked)}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteChoice(option.id, choice.id)}
                          style={{ ...secondaryButton(), color: "#b91c1c" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={() => addChoice(option.id)} style={secondaryButton()}>
                    + Add choice
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ ...card(), marginTop: "20px" }}>
        <div style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "12px" }}>
          Option Sets
        </div>

        {optionSets.length === 0 ? (
          <p style={{ color: "#6b7280", margin: 0 }}>No option sets yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "16px",
            }}
          >
            {optionSets.map((set) => (
              <div
                key={set.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "#fff",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{set.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "13px" }}>
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
                    <button type="submit" style={primaryButton()}>Add</button>
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
                    <button type="submit" style={primaryButton()}>Add</button>
                  </div>
                </Form>

                {set.assignments.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "6px", fontWeight: 700 }}>
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
                        }}
                      >
                        <span>{productTitleMap[assignment.shopifyProductId] || `ID: ${assignment.shopifyProductId}`}</span>

                        <Form method="post">
                          <input type="hidden" name="intent" value="deleteAssignment" />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <button
                            type="submit"
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </Form>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => loadSet(set)} style={{ ...secondaryButton(), flex: 1 }}>
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