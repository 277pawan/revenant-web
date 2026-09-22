/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_MARKETING_URL?: string;
  /** Published agent image customers pull — API URL is baked into that image */
  readonly VITE_AGENT_IMAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
