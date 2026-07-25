/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Aggregator WebSocket URL, baked in at build time.
   *
   * Required for packed .ehpk builds -- the page is served from a local
   * bundle there, so it cannot derive the Mac's address from its own
   * location. Set in .env.production.
   */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
