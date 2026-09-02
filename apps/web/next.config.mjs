/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained Node runtime so the web service can be copied to a
  // clean server image without carrying development dependencies.
  output: "standalone",
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
