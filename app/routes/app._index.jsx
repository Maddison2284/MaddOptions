import { useLoaderData, Link } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const [optionSets, assignments] = await Promise.all([
      prisma.optionSet.findMany({
        include: {
          fields: true,
          assignments: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.productOptionSet.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          optionSet: true,
        },
      }),
    ]);

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
      title: node.title,
    }));

    const productTitleMap = Object.fromEntries(products.map((p) => [p.id, p.title]));

    const totalFields = optionSets.reduce((sum, set) => sum + set.fields.length, 0);
    const totalAssignments = optionSets.reduce((sum, set) => sum + set.assignments.length, 0);

    const recentSets = optionSets.slice(0, 6).map((set) => ({
      id: set.id,
      name: set.name,
      fieldCount: set.fields.length,
      assignmentCount: set.assignments.length,
      updatedAt: set.updatedAt,
    }));

    const recentAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      productId: assignment.shopifyProductId,
      productTitle:
        productTitleMap[assignment.shopifyProductId] ||
        `Product ID: ${assignment.shopifyProductId}`,
      optionSetName: assignment.optionSet?.name || "Unknown Set",
      updatedAt: assignment.updatedAt,
    }));

    return {
      stats: {
        totalOptionSets: optionSets.length,
        totalFields,
        totalAssignments,
        totalProductsFetched: products.length,
      },
      recentSets,
      recentAssignments,
    };
  } catch (error) {
    return {
      stats: {
        totalOptionSets: 0,
        totalFields: 0,
        totalAssignments: 0,
        totalProductsFetched: 0,
      },
      recentSets: [],
      recentAssignments: [],
    };
  }
}

function card() {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "20px",
  };
}

function statCard() {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "20px",
    minHeight: "132px",
  };
}

function pill(color = "#111827", bg = "#f3f4f6") {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    color,
    background: bg,
  };
}

function primaryLinkButton() {
  return {
    display: "inline-block",
    textDecoration: "none",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 800,
  };
}

function secondaryLinkButton() {
  return {
    display: "inline-block",
    textDecoration: "none",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    border: "1px solid #d1d5db",
  };
}

export default function DashboardPage() {
  const { stats, recentSets, recentAssignments } = useLoaderData();

  return (
    <div>
      <div
        style={{
          ...card(),
          marginBottom: "20px",
          background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
        }}
      >
        <div style={{ ...pill("#3730a3", "#eef2ff"), marginBottom: "12px" }}>
          Dashboard
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "20px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "34px", color: "#111827", fontWeight: 900 }}>
              MaddOptions Dashboard
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                color: "#6b7280",
                maxWidth: "760px",
                lineHeight: 1.6,
              }}
            >
              This is now your home base. Use Option Sets as the working builder page,
              while dashboard stays focused on stats, recent activity, and quick navigation.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link to="/app/option-sets" style={primaryLinkButton()}>
              Open Option Sets
            </Link>
            <Link to="/app/pricing" style={secondaryLinkButton()}>
              View Pricing
            </Link>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div style={statCard()}>
          <div style={{ color: "#6b7280", fontWeight: 700, fontSize: "13px" }}>OPTION SETS</div>
          <div style={{ fontSize: "34px", fontWeight: 900, color: "#111827", marginTop: "8px" }}>
            {stats.totalOptionSets}
          </div>
          <div style={{ color: "#6b7280", marginTop: "6px", fontSize: "14px" }}>
            Total sets saved in the app
          </div>
        </div>

        <div style={statCard()}>
          <div style={{ color: "#6b7280", fontWeight: 700, fontSize: "13px" }}>FIELDS</div>
          <div style={{ fontSize: "34px", fontWeight: 900, color: "#111827", marginTop: "8px" }}>
            {stats.totalFields}
          </div>
          <div style={{ color: "#6b7280", marginTop: "6px", fontSize: "14px" }}>
            Total custom fields across all sets
          </div>
        </div>

        <div style={statCard()}>
          <div style={{ color: "#6b7280", fontWeight: 700, fontSize: "13px" }}>ASSIGNMENTS</div>
          <div style={{ fontSize: "34px", fontWeight: 900, color: "#111827", marginTop: "8px" }}>
            {stats.totalAssignments}
          </div>
          <div style={{ color: "#6b7280", marginTop: "6px", fontSize: "14px" }}>
            Product-to-set connections
          </div>
        </div>

        <div style={statCard()}>
          <div style={{ color: "#6b7280", fontWeight: 700, fontSize: "13px" }}>PRODUCTS LOADED</div>
          <div style={{ fontSize: "34px", fontWeight: 900, color: "#111827", marginTop: "8px" }}>
            {stats.totalProductsFetched}
          </div>
          <div style={{ color: "#6b7280", marginTop: "6px", fontSize: "14px" }}>
            Shopify products fetched for admin use
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "20px",
        }}
      >
        <div style={card()}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              marginBottom: "14px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#111827" }}>
                Recent Option Sets
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Your newest saved builders
              </div>
            </div>

            <Link to="/app/option-sets" style={secondaryLinkButton()}>
              Manage Sets
            </Link>
          </div>

          {recentSets.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No option sets yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {recentSets.map((set) => (
                <div
                  key={set.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "16px",
                    padding: "14px",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#111827", fontSize: "16px" }}>
                    {set.name}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "6px" }}>
                    {set.fieldCount} fields • {set.assignmentCount} assigned
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card()}>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#111827",
              marginBottom: "14px",
            }}
          >
            Recent Assignments
          </div>

          {recentAssignments.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No assignments yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {recentAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "16px",
                    padding: "14px",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#111827" }}>
                    {assignment.productTitle}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "6px" }}>
                    Assigned to: {assignment.optionSetName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}