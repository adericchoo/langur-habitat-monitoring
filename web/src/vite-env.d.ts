/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * XYZ tile URL template for the 2025 satellite basemap (e.g.
   * https://cdn.example/basemap/{z}/{x}/{y}.png). Dev default lives in
   * MapStage; prod sets this to the hosted template. See web/.env.example.
   */
  readonly VITE_BASEMAP_TILES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
