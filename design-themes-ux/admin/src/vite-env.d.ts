/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Store the vendor portal signs in to (vendor.html). */
  readonly VITE_VENDOR_STORE_ID?: string;
}
