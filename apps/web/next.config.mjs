/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker copies the self-contained runtime; Vercel supplies its own runtime
  // and build integration, so standalone output must be disabled there.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
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
