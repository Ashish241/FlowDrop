// Build only; this command does not authenticate, push, upload or deploy.
import { build } from "vite";
import process from "node:process";
process.env.FLOWDROP_PAGES_RELEASE = "1";
await build({ mode: "online" });
