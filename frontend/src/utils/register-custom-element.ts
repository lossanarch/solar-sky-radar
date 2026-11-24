/**
 * Safe, Home Assistant & WebKit-hardened CustomElement registration helper.
 *
 * Handles three real-world Home Assistant / iOS WKWebView races that otherwise
 * surface as intermittent "Configuration error" (`hui-error-card`) placeholders:
 *
 * 1. Early `extra_module_url` evaluation before `@webcomponents/scoped-custom-element-registry`
 *    replaces `window.customElements` (HA <=2026.10 `#53890` / `#52960`, or before
 *    `window.__haScopedRegistryReady` settles in HA 2026.11+):
 *    Wait for the polyfill before calling `define()` so we neither lose the registration
 *    on the discarded native registry nor block the polyfill's stand-in element class.
 * 2. Post-load `window.customElements` swap: if `window.customElements` changes identity
 *    after registration, re-register onto the active registry once `home-assistant` boots.
 * 3. Duplicate script/module loads (e.g. cached + cache-busted `?v=` URLs in the same session):
 *    guard with `customElements.get(tagName)` so `define()` never throws `DOMException`.
 */

interface HaScopedWindow extends Window {
  __haScopedRegistryReady?: Promise<unknown>;
  CustomElementRegistryPolyfill?: unknown;
}

function isHaAwaitingScopedPolyfill(win: HaScopedWindow): boolean {
  if (win.CustomElementRegistryPolyfill !== undefined) {
    return false;
  }
  if (win.customElements?.get("home-assistant") !== undefined) {
    return false;
  }
  if (win.__haScopedRegistryReady !== undefined) {
    return true;
  }
  if (typeof document !== "undefined") {
    return document.querySelector("home-assistant") !== null;
  }
  return false;
}

function tryDefineOnCurrentRegistry(
  win: HaScopedWindow,
  tagName: string,
  ctor: CustomElementConstructor
): CustomElementRegistry | null {
  const registry = win.customElements;
  if (!registry) return null;
  if (!registry.get(tagName)) {
    try {
      registry.define(tagName, ctor);
    } catch (err) {
      if (!registry.get(tagName)) {
        console.warn(`[solar-sky-radar] CustomElement define retry needed for <${tagName}>:`, err);
        return null;
      }
    }
  }
  return registry;
}

function installRegistrySwapHealGuard(
  win: HaScopedWindow,
  initialRegistry: CustomElementRegistry | null,
  tagName: string,
  ctor: CustomElementConstructor
): void {
  let activeRegistry = initialRegistry;

  const healIfSwapped = (): boolean => {
    const current = win.customElements;
    if (!current) return false;
    if (current !== activeRegistry || !current.get(tagName)) {
      const definedOn = tryDefineOnCurrentRegistry(win, tagName, ctor);
      if (definedOn) {
        activeRegistry = definedOn;
        return true;
      }
    }
    return false;
  };

  if (typeof win.customElements?.whenDefined === "function") {
    void win.customElements
      .whenDefined("home-assistant")
      .then(() => {
        healIfSwapped();
      })
      .catch(() => {});
  }

  let checks = 0;
  const maxChecks = 40; // 40 * 50ms = 2.0s bounded check
  const timer = globalThis.setInterval(() => {
    checks += 1;
    healIfSwapped();
    if (
      checks >= maxChecks ||
      win.CustomElementRegistryPolyfill !== undefined ||
      win.customElements?.get("home-assistant") !== undefined
    ) {
      healIfSwapped();
      globalThis.clearInterval(timer);
    }
  }, 50);
  (timer as unknown as { unref?: () => void })?.unref?.();
}

export function defineCustomElementSafely(
  tagName: string,
  ctor: CustomElementConstructor,
  win: HaScopedWindow = globalThis.window as HaScopedWindow
): void {
  if (!win?.customElements) return;

  // Fast synchronous path (99% of loads & all non-HA / post-polyfill environments):
  // registers in 0ms so even `panel: true` Lovelace views see the element immediately.
  if (!isHaAwaitingScopedPolyfill(win)) {
    const reg = tryDefineOnCurrentRegistry(win, tagName, ctor);
    installRegistrySwapHealGuard(win, reg, tagName, ctor);
    return;
  }

  // Deferred path when running inside HA's index.html before the scoped registry polyfill
  // has finished initializing (`window.__haScopedRegistryReady` or `<home-assistant>` boot).
  let finished = false;
  const finishRegistration = () => {
    if (finished) return;
    finished = true;
    const reg = tryDefineOnCurrentRegistry(win, tagName, ctor);
    installRegistrySwapHealGuard(win, reg, tagName, ctor);
  };

  if (win.__haScopedRegistryReady) {
    void Promise.resolve(win.__haScopedRegistryReady)
      .catch(() => {})
      .then(finishRegistration);
  }

  const startedAt = Date.now();
  const poll = () => {
    if (finished) return;
    if (!isHaAwaitingScopedPolyfill(win) || Date.now() - startedAt >= 1200) {
      finishRegistration();
      return;
    }
    globalThis.setTimeout(poll, 10);
  };
  globalThis.setTimeout(poll, 10);
}
