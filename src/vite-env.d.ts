/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Published agent image customers pull — API URL is baked into that image */
  readonly VITE_AGENT_IMAGE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
