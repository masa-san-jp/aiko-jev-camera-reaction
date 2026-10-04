/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JEV_PROXY_URL?: string;
  readonly VITE_MEDIA_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
