import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Treat libSQL native bindings as external on the server so Turbopack
  // doesn't try to bundle their native deps (`fs`, `child_process`, etc.).
  serverExternalPackages: ["libsql", "@libsql/client"],
};

export default nextConfig;
