/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Same-origin path (or absolute URL) of the Kroki instance, e.g. `/kroki`. */
  readonly VITE_KROKI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
