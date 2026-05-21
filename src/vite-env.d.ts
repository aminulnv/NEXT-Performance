/// <reference types="vite/client" />

declare module '*.css' {
  const classes: Record<string, string>
  export default classes
}

interface ImportMetaEnv {
  readonly VITE_BYPASS_AUTH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
