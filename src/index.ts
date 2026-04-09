/**
 * @pathscale/psc-fathom-client
 *
 * Vanilla ESM port of the official Fathom Analytics tracker.
 * Source: https://cdn.usefathom.com/script.js
 *
 * DOM data-* attribute parsing replaced by load(siteId, opts).
 * SPA history/hash patching removed — use framework routing hooks instead.
 */

const TRACKER_URL = "https://cdn.usefathom.com/";

// -- state --------------------------------------------------------------------

let siteId: string | null = null;
let pageStart: number | null = null;
let currentHostname: string | null = null;
let currentPathname: string | null = null;
let currentSiteId: string | null = null;
let currentQueryString: string | null = null;

let useCanonical = true;
let honorDNTFlag = false;
let excludedDomains: string[] = [];
let includedDomains: string[] = [];
let loaded = false;

// -- helpers ------------------------------------------------------------------

const QS_KEYS = [
  "keyword", "q", "ref", "s",
  "utm_campaign", "utm_content", "utm_medium", "utm_source", "utm_term",
  "action", "name", "pagename", "tab", "via", "gclid", "msclkid",
];

function encodeParams(params: Record<string, unknown>): string {
  const p: Record<string, unknown> = {
    ...params,
    cid: Math.floor(1e8 * Math.random()) + 1,
  };
  return (
    "?" +
    Object.keys(p)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(String(p[k])))
      .join("&")
  );
}

function extractQueryString(): Record<string, string> {
  const data: Record<string, string> = {};
  const search = window.location.search;
  if (!search) return data;
  const pairs = search.substring(search.indexOf("?") + 1).split("&");
  for (const raw of pairs) {
    if (!raw) continue;
    const [k, v] = raw.split("=");
    if (QS_KEYS.indexOf(decodeURIComponent(k)) >= 0) {
      data[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  }
  return data;
}

function isTrackingAllowed(): boolean {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return false;

  let blocked = false;
  try {
    blocked = !!(window.localStorage && window.localStorage.getItem("blockFathomTracking"));
  } catch {
    /* private browsing */
  }

  const prerender =
    "visibilityState" in document && (document.visibilityState as string) === "prerender";
  const isExcluded = excludedDomains.indexOf(hostname) >= 0;
  const isIncluded = includedDomains.length === 0 || includedDomains.indexOf(hostname) >= 0;
  const dnt = honorDNTFlag && "doNotTrack" in navigator && navigator.doNotTrack === "1";

  return !blocked && !prerender && !isExcluded && isIncluded && !dnt;
}

function resolveLocation(params: { url?: string }): {
  protocol: string;
  hostname: string;
  pathname: string;
  hash: string;
} {
  if (params.url !== undefined) {
    const a = document.createElement("a");
    a.href = params.url;
    return a;
  }
  if (useCanonical) {
    const link = document.querySelector('link[rel="canonical"][href]');
    if (link) {
      const a = document.createElement("a");
      a.href = (link as HTMLLinkElement).href;
      return a;
    }
  }
  return window.location;
}

function sendPixel(params: Record<string, unknown>) {
  if (!isTrackingAllowed()) return;
  const img = document.createElement("img");
  img.setAttribute("alt", "");
  img.setAttribute("aria-hidden", "true");
  img.style.position = "absolute";
  img.src = TRACKER_URL + encodeParams(params);
  img.addEventListener("load", () => img.parentNode?.removeChild(img));
  img.addEventListener("error", () => img.parentNode?.removeChild(img));
  document.body.appendChild(img);
}

function sendBeaconRequest(params: Record<string, unknown>) {
  if (!isTrackingAllowed()) return;
  navigator.sendBeacon(TRACKER_URL + encodeParams(params));
}

function sendDeparturePing() {
  if (!pageStart || !isTrackingAllowed()) return;
  const duration = Math.min(Math.round((Date.now() - pageStart) / 1000), 1800);
  pageStart = null;
  if (duration <= 0) return;
  navigator.sendBeacon(
    TRACKER_URL +
      encodeParams({
        dp: 1,
        sid: currentSiteId || siteId,
        h: currentHostname,
        p: currentPathname,
        qs: currentQueryString,
        d: duration,
      }),
  );
}

// -- public API ---------------------------------------------------------------

export interface LoadOptions {
  /** Fire an automatic pageview on load (default: true) */
  auto?: boolean;
  /** Use <link rel="canonical"> for URL resolution (default: true) */
  canonical?: boolean;
  /** Honor navigator.doNotTrack (default: false) */
  honorDNT?: boolean;
  /** Block tracking on these hostnames */
  excludedDomains?: string[];
  /** Only allow tracking on these hostnames (empty = allow all) */
  includedDomains?: string[];
}

export function load(id: string, opts?: LoadOptions) {
  if (loaded) return;
  loaded = true;
  siteId = id;

  if (opts?.canonical === false) useCanonical = false;
  if (opts?.honorDNT) honorDNTFlag = true;
  if (opts?.excludedDomains) excludedDomains = opts.excludedDomains;
  if (opts?.includedDomains) includedDomains = opts.includedDomains;

  // departure pings on page hide
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendDeparturePing();
  });
  window.addEventListener("pagehide", sendDeparturePing);

  // auto pageview (disabled when auto: false)
  if (opts?.auto !== false) {
    if ((document as any).prerendering) {
      document.addEventListener("prerenderingchange", () => trackPageview(), { once: true });
    } else {
      setTimeout(() => trackPageview());
    }
  }
}

export function trackPageview(params: { url?: string; referrer?: string } = {}) {
  sendDeparturePing();
  const loc = resolveLocation(params);
  if (!loc.hostname) return;
  const hostname = loc.protocol + "//" + loc.hostname;
  const pathname = loc.pathname || "/";
  sendBeaconRequest({
    h: hostname,
    p: pathname,
    r: params.referrer || (document.referrer.indexOf(hostname) < 0 ? document.referrer : ""),
    sid: siteId,
    qs: JSON.stringify(extractQueryString()),
  });
  pageStart = Date.now();
  currentHostname = hostname;
  currentPathname = pathname;
  currentSiteId = siteId;
  currentQueryString = JSON.stringify(extractQueryString());
}

export function trackGoal(code: string, cents: number) {
  const loc = resolveLocation({});
  const hostname = loc.protocol + "//" + loc.hostname;
  sendBeaconRequest({
    gcode: code,
    gval: cents,
    qs: JSON.stringify(extractQueryString()),
    p: loc.pathname || "/",
    h: hostname,
    r: document.referrer.indexOf(hostname) < 0 ? document.referrer : "",
    sid: siteId,
  });
}

export function trackEvent(name: string, payload: Record<string, unknown> = {}) {
  const loc = resolveLocation({});
  const hostname = loc.protocol + "//" + loc.hostname;
  sendBeaconRequest({
    name,
    payload: JSON.stringify(payload),
    p: loc.pathname || "/",
    h: hostname,
    r: document.referrer.indexOf(hostname) < 0 ? document.referrer : "",
    sid: siteId,
    qs: JSON.stringify(extractQueryString()),
  });
}

export function setSite(id: string) {
  siteId = id;
}

export function blockTrackingForMe() {
  if (window.localStorage) {
    window.localStorage.setItem("blockFathomTracking", "true");
  }
}

export function enableTrackingForMe() {
  if (window.localStorage) {
    window.localStorage.removeItem("blockFathomTracking");
  }
}

export function isTrackingEnabled(): boolean {
  return isTrackingAllowed() === true;
}
