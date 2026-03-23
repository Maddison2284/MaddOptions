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

function getShopifyContentType(mimeType = "") {
  const normalized = String(mimeType).toLowerCase();

  if (normalized.startsWith("image/")) return "IMAGE";
  if (normalized === "application/pdf") return "FILE";
  if (normalized.includes("svg")) return "FILE";
  if (normalized.includes("illustrator")) return "FILE";
  if (normalized.includes("eps")) return "FILE";

  return "FILE";
}

function getStagedResourceType(shopifyContentType) {
  if (shopifyContentType === "IMAGE") return "IMAGE";
  return "FILE";
}

function extractCreatedFileUrl(createdFile) {
  if (!createdFile) return "";

  if (createdFile.image?.url) return createdFile.image.url;
  if (createdFile.preview?.image?.url) return createdFile.preview.image.url;
  if (createdFile.url) return createdFile.url;
  if (createdFile.originalSource?.url) return createdFile.originalSource.url;

  return "";
}

export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return json({ ok: false, error: "No file uploaded" }, 400);
    }

    const filename = file.name || "upload-file";
    const mimeType = file.type || "application/octet-stream";
    const fileSize = Number(file.size || 0);

    if (fileSize <= 0) {
      return json({ ok: false, error: "Uploaded file is empty" }, 400);
    }

    const maxBytes = 25 * 1024 * 1024;
    if (fileSize > maxBytes) {
      return json({ ok: false, error: "File exceeds 25MB limit" }, 400);
    }

    const shopifyContentType = getShopifyContentType(mimeType);
    const stagedResourceType = getStagedResourceType(shopifyContentType);

    const stagedRes = await admin.graphql(
      `
        #graphql
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          input: [
            {
              filename,
              mimeType,
              httpMethod: "POST",
              resource: stagedResourceType,
              fileSize: String(fileSize),
            },
          ],
        },
      }
    );

    const stagedJson = await stagedRes.json();
    const stagedTarget = stagedJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    const stagedErrors = stagedJson?.data?.stagedUploadsCreate?.userErrors || [];

    if (!stagedTarget || stagedErrors.length > 0) {
      return json(
        {
          ok: false,
          error: stagedErrors[0]?.message || "Could not create staged upload",
          details: stagedErrors,
        },
        400
      );
    }

    const uploadForm = new FormData();
    for (const param of stagedTarget.parameters || []) {
      uploadForm.append(param.name, param.value);
    }
    uploadForm.append("file", file);

    const uploadResponse = await fetch(stagedTarget.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadResponse.ok) {
      const uploadText = await uploadResponse.text().catch(() => "");
      return json(
        {
          ok: false,
          error: "Upload to Shopify storage failed",
          details: uploadText,
        },
        400
      );
    }

    const createFileRes = await admin.graphql(
      `
        #graphql
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              alt
              createdAt
              fileStatus
              ... on MediaImage {
                image {
                  url
                }
              }
              ... on GenericFile {
                url
                preview {
                  image {
                    url
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          files: [
            {
              contentType: shopifyContentType,
              originalSource: stagedTarget.resourceUrl,
              alt: filename,
            },
          ],
        },
      }
    );

    const createFileJson = await createFileRes.json();
    const createdFile = createFileJson?.data?.fileCreate?.files?.[0];
    const fileErrors = createFileJson?.data?.fileCreate?.userErrors || [];

    if (!createdFile || fileErrors.length > 0) {
      return json(
        {
          ok: false,
          error: fileErrors[0]?.message || "Could not create Shopify file",
          details: fileErrors,
        },
        400
      );
    }

    const fileUrl = extractCreatedFileUrl(createdFile);

    return json({
      ok: true,
      id: createdFile.id || "",
      alt: createdFile.alt || filename,
      fileStatus: createdFile.fileStatus || "",
      contentType: shopifyContentType,
      url: fileUrl,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  }
}