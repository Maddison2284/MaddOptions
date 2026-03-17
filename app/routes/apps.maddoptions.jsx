import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function loader({ request }) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");

    if (!productId) {
      return new Response(JSON.stringify({ error: "Missing product_id" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
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

    if (!assignment || !assignment.optionSet) {
      return new Response(JSON.stringify({ optionSet: null }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const optionSet = {
      id: assignment.optionSet.id,
      name: assignment.optionSet.name,
      fields: assignment.optionSet.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        isRequired: field.isRequired,
        helpText: field.helpText || "",
        placeholder: field.placeholder || "",
        choices: field.choices
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((choice) => ({
            id: choice.id,
            label: choice.label,
            value: choice.value,
            price: choice.priceValue ?? 0,
            imageUrl: choice.imageUrl || "",
            colorHex: choice.colorHex || "",
          })),
      })),
    };

    return new Response(JSON.stringify({ optionSet }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Server error",
        details: String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
function addAddonToCart(extraPrice) {
  if (extraPrice <= 0) return;

  fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: YOUR_ADDON_VARIANT_ID, // replace this
      quantity: 1,
      properties: {
        "_maddoptions": "true",
        "_addon_price": extraPrice.toFixed(2)
      }
    })
  });
}
async function removeExistingAddon() {
  const cart = await fetch('/cart.js').then(r => r.json());

  for (let item of cart.items) {
    if (item.properties && item.properties._maddoptions === "true") {
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.key,
          quantity: 0
        })
      });
    }
  }
}