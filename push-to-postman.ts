import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config(); 

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY || "your-postman-api-key";
const WORKSPACE_ID = process.env.POSTMAN_WORKSPACE_ID || "your-workspace-id";

async function pushToPostman() {
  if (!fs.existsSync("./swagger.json")) {
    console.error("❌ swagger.json not found. Run the app first to generate it.");
    process.exit(1);
  }

  const swagger = JSON.parse(fs.readFileSync("./swagger.json", "utf8"));

  console.log("🚀 Pushing to Postman...");

  const res = await fetch("https://api.getpostman.com/import/openapi", {
    method: "POST",
    headers: {
      "X-Api-Key": POSTMAN_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "json",
      input: swagger,
      options: { workspaceId: WORKSPACE_ID },
    }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log("✅ Successfully pushed to Postman!");
    console.log("📁 Collection:", data?.collections?.[0]?.name);
  } else {
    console.error("❌ Failed:", data);
  }
}

pushToPostman();