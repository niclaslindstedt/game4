// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACEHOLDER. The app shell — the attract card, the front door, the loading
// card, the run and the HUD over it — lands here with the renderer; until
// then the page is the boot card with the app's name on it, so the build,
// the service worker and the deploy slots can all be exercised end to end.
import { APP_NAME, PUBLISHER } from "./identity.ts";

export function App() {
  return (
    <div class="boot">
      <h1 class="boot-name">{APP_NAME}</h1>
      <p class="boot-note">{PUBLISHER}</p>
    </div>
  );
}
