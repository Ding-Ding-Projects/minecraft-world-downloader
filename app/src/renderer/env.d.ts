/// <reference types="vite/client" />

import type { StudioApi } from '../shared/api';

declare global {
  interface Window {
    /**
     * The privileged bridge, installed by the preload script.
     *
     * It is the ONLY route from renderer code to the operating system: there is
     * no `require`, no `process` and no Node integration in this context.
     */
    studio: StudioApi;
  }
}

export {};
