const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const optionSet = await prisma.optionSet.create({
    data: {
      name: "Sample Option Set",
      fields: {
        create: [
          {
            label: "Sample Text Field",
            type: "text",
            isRequired: false,
            sortOrder: 1
          },
          {
            label: "Sample Radio Field",
            type: "radio",
            isRequired: false,
            sortOrder: 2,
            choices: {
              create: [
                {
                  label: "Option A",
                  value: "option_a",
                  priceMode: "fixed",
                  priceValue: 5,
                  sortOrder: 1
                },
                {
                  label: "Option B",
                  value: "option_b",
                  priceMode: "fixed",
                  priceValue: 10,
                  sortOrder: 2
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log("Seeded option set:", optionSet.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });