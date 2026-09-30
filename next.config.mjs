/** @type {import('next').NextConfig} */
// jeevanayurveda.in par: /crm, /login, /api CRM chalata hai; baaki sab (website) GitHub Pages se aata hai.
const SITE = "https://skhirnval-code.github.io/Jeeavan-Ayurveda-1";
const onMainDomain = [{ type: "host", value: "(www\\.)?jeevanayurveda\\.in" }];
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", has: onMainDomain, destination: `${SITE}/` }],
      afterFiles: [],
      fallback: [{ source: "/:path*", has: onMainDomain, destination: `${SITE}/:path*` }],
    };
  },
};
export default nextConfig;
