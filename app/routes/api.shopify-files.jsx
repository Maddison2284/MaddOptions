import { authenticate } from "../shopify.server";

export async function loader({ request }) {
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

  const json = await response.json();

  const files = (json?.data?.files?.edges || [])
    .map(({ node }) => ({
      id: node.id,
      url: node.image?.url || "",
      alt: node.image?.altText || "",
    }))
    .filter((file) => file.url);

  return { files };
}