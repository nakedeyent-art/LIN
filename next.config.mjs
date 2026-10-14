import { fileURLToPath } from "node:url";
/** @type {import('next').NextConfig} */
// Server actions accept up to 8 MB so a message can carry three 2 MB attachments (the app enforces the real limits).
export default { reactStrictMode: true, outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)), outputFileTracingIncludes: { "/*": ["./assets/fonts/*.ttf"] }, experimental: { serverActions: { bodySizeLimit: "8mb" } } };
