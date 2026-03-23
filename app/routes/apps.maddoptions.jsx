import prisma from "../db.server";
import { authenticate } from "../shopify.server";

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeOptionSet(optionSet) {
  if (!optionSet) return null;

  return {
    id: optionSet.id,
    name: optionSet.name,
    handle: slugify(optionSet.name),
    fields: (optionSet.fields || []).map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      isRequired: field.isRequired,
      helpText: field.helpText || "",
      placeholder: field.placeholder || "",
      flatPrice: field.priceValue ?? 0,
      priceMode: field.priceMode || "none",
      allowMultiple: !!field.allowMultiple,
      minSelect: field.minSelect ?? null,
      maxSelect: field.maxSelect ?? null,
      config: parseJson(field.configJson, {}),
      choices: (field.choices || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((choice) => ({
          id: choice.id,
          label: choice.label,
          value: choice.value,
          price: choice.priceValue ?? 0,
          priceMode: choice.priceMode || "none",
          imageUrl: choice.imageUrl || "",
          colorHex: choice.colorHex || "",
          linkedVariantId: choice.linkedVariantId || "",
          config: parseJson(choice.configJson, {}),
        })),
    })),
    pricingMode: "variant_addons_with_properties",
  };
}

async function findOptionSet({ source, productId, optionSetId, optionSetHandle }) {
  if (source === "manual_option_set_id" && optionSetId) {
    return prisma.optionSet.findUnique({
      where: { id: Number(optionSetId) },
      include: {
        fields: {
          include: {
            choices: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  if (source === "manual_option_set_handle" && optionSetHandle) {
    const allSets = await prisma.optionSet.findMany({
      include: {
        fields: {
          include: {
            choices: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return allSets.find((set) => slugify(set.name) === slugify(optionSetHandle)) || null;
  }

  if (!productId) {
    return null;
  }

  const assignment = await prisma.productOptionSet.findFirst({
    where: {
      shopifyProductId: String(productId),
    },
    include: {
      optionSet: {
        include: {
          fields: {
            include: {
              choices: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  return assignment?.optionSet || null;
}

export async function loader({ request }) {
  try {
    await authenticate.public.appProxy(request);

    const url = new URL(request.url);
    const source = url.searchParams.get("source") || "auto_product_assignment";
    const productId = url.searchParams.get("product_id");
    const optionSetId = url.searchParams.get("option_set_id");
    const optionSetHandle = url.searchParams.get("option_set_handle");

    if (source === "auto_product_assignment" && !productId) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing product_id for auto product assignment",
          optionSet: null,
        },
        400,
      );
    }

    const optionSet = await findOptionSet({
      source,
      productId,
      optionSetId,
      optionSetHandle,
    });

    return jsonResponse({
      ok: true,
      source,
      productId: productId || null,
      optionSet: normalizeOptionSet(optionSet),
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 500;

    return jsonResponse(
      {
        ok: false,
        error: status === 401 ? "Unauthorized app proxy request" : "Server error",
        details: String(error),
        optionSet: null,
      },
      status,
    );
  }
}
