import { authenticate } from "../shopify.server";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
      #graphql
      query GetFiles {
        files(first: 50, query: "media_type:IMAGE") {
          edges {
            node {
              id
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    `);

    const payload = await response.json();

    const files = (payload?.data?.files?.edges || [])
      .map(({ node }) => ({
        id: node.id,
        url: node.image?.url || "",
        alt: node.image?.altText || "",
      }))
      .filter((file) => file.url);

    return json({ ok: true, files });
  } catch (error) {
    return json(
      {
        ok: false,
        files: [],
        error: String(error),
      },
      500,
    );
  }
}
