import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db";

async function main() {
  loadEnvConfig(process.cwd());
  await connectToDatabase();
  console.log("MongoDB connection successful.");
  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error("MongoDB connection failed:", error);
  process.exitCode = 1;
});
