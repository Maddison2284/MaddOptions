import { Form, useLoaderData, redirect } from "react-router";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../shopify.server";

const prisma = new PrismaClient();

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const assignments = await prisma.productOptionSet.findMany({
    include: {
      optionSet: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const response = await admin.graphql(`
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

  const json = await response.json();

  const productMap = {};
  (json?.data?.products?.edges || []).forEach(({ node }) => {
    const id = node.id.split("/").pop();
    productMap[id] = node.title;
  });

  return { assignments, productMap };
}

export async function action({ request }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const assignmentId = formData.get("assignmentId");

  if (assignmentId) {
    await prisma.productOptionSet.delete({
      where: { id: Number(assignmentId) },
    });
  }

  return redirect("/app/assignments");
}

function cardStyle() {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
  };
}

export default function AssignmentsPage() {
  const { assignments, productMap } = useLoaderData();

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", color: "#111827" }}>Assignments</h1>
        <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
          View and manage every product currently connected to an option set.
        </p>
      </div>

      <div style={cardStyle()}>
        {assignments.length === 0 ? (
          <p style={{ color: "#6b7280", margin: 0 }}>No assignments yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "#111827" }}>
                    {productMap[assignment.shopifyProductId] || `Product ID: ${assignment.shopifyProductId}`}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
                    Option Set: {assignment.optionSet.name}
                  </div>
                </div>

                <Form method="post">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <button
                    type="submit"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#dc2626",
                      color: "#ffffff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </Form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}