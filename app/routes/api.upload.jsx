import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "madduploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeName = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const fullPath = path.join(uploadsDir, safeName);

    await fs.writeFile(fullPath, buffer);

    return new Response(
      JSON.stringify({
        ok: true,
        url: `/madduploads/${safeName}`,
        name: file.name,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}