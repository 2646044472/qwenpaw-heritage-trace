import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Heritage Trace",
  version: packageJson.version,
  copyright: `© ${currentYear}, 澳創.`,
  meta: {
    title: "Heritage Trace · 澳創",
    description: "Three adaptive interfaces for Macau heritage intelligence.",
  },
};
