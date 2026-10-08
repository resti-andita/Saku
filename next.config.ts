import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* better-sqlite3 adalah modul native: jangan ikut di-bundle, cukup di-require
     saat runtime dari node_modules. */
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
