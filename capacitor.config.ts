import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aliasnonam.riftboundcatalogue",
  appName: "Riftbound Catalogue",
  webDir: "mobile-dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
