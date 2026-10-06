/** @type {import('next').NextConfig} */
// Server actions accept up to 8 MB so a message can carry three 2 MB attachments (the app enforces the real limits).
export default { reactStrictMode: true, experimental: { serverActions: { bodySizeLimit: "8mb" } } };
