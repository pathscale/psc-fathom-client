# @pathscale/psc-fathom-client

Bundled [Fathom Analytics](https://usefathom.com) tracker as a clean ESM module.

**Drop-in replacement for [`fathom-client`](https://github.com/derrickreimer/fathom-client)** with key differences:

- **No CDN fetch.** The tracker JS is bundled inline — no external `<script>` tag injected at runtime. Only beacon requests go to Fathom's servers.
- **No async loading dance.** Functions work immediately after `load()` — no queuing, no waiting for a remote script.
- **Departure ping flush on SPA navigation.** `trackPageview()` flushes the previous page's duration before recording the new one, so intermediate page times aren't lost.
- **Localhost blocking.** Tracking is automatically disabled on `localhost`, `127.0.0.1`, and `[::1]`.

Adapted from the [official Fathom script](https://cdn.usefathom.com/script.js).

## Installation

```bash
npm install @pathscale/psc-fathom-client
```

## Motivation

The standard Fathom installation drops a `<script>` tag that loads the tracker from their CDN. The [`fathom-client`](https://github.com/derrickreimer/fathom-client) package wraps this by injecting the script asynchronously at runtime.

This works, but:

- You're loading external JavaScript — a security and CSP concern.
- The tracker isn't available synchronously — calls must be queued until the script loads.
- You have no visibility into what the script does (it can change at any time on the CDN).

This package bundles the tracker logic directly into your app. The JavaScript never comes from a CDN. Beacon requests still go to Fathom for server-side processing.

## Usage

```ts
import * as Fathom from "@pathscale/psc-fathom-client";

// Initialize — auto: false disables the automatic first pageview
Fathom.load("MY_FATHOM_ID", { auto: false });

// Track a pageview (call on every route change for SPAs)
Fathom.trackPageview();

// Track with an explicit URL
Fathom.trackPageview({ url: "/custom-path" });

// Track a conversion goal
Fathom.trackGoal("GOAL_CODE", 100); // code, cents

// Track a custom event
Fathom.trackEvent("signup", { plan: "pro" });
```

## API Reference

### `load(siteId: string, opts?: object)`

Initialize the tracker. Call once on app startup.

#### Arguments

- `siteId` - The site ID provided in the Fathom UI.
- `opts` - An Object of options:
  - `auto` - When `false`, skips automatically tracking page views on load (defaults to `true`).
  - `honorDNT` - When `true`, honors the [DNT header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT) in the visitor's browser (defaults to `false`).
  - `canonical` - When `false`, ignores the canonical tag if present (defaults to `true`).
  - `excludedDomains` - An array of hostnames where tracking should be blocked.
  - `includedDomains` - An array of hostnames where tracking is allowed (empty = allow all).

#### Example

```ts
import { load } from "@pathscale/psc-fathom-client";

load("MY_FATHOM_ID", {
  auto: false,
  honorDNT: true,
});
```

### `trackPageview(opts?: object)`

Tracks a pageview. Automatically flushes the previous page's departure ping before recording.

#### Arguments

- `opts` - An Object of options:
  - `url` - When set, overrides `window.location`.
  - `referrer` - When set, overrides `document.referrer`.

#### Example

```ts
import { trackPageview } from "@pathscale/psc-fathom-client";

trackPageview();
```

### `trackEvent(eventName: string, payload?: object)`

Tracks a custom event.

#### Arguments

- `eventName` - The event name.
- `payload` - Optional key-value data to attach.

#### Example

```ts
import { trackEvent } from "@pathscale/psc-fathom-client";

trackEvent("checkout completed", { _value: 100 });
```

### `trackGoal(code: string, cents: number)`

Tracks a conversion goal.

#### Arguments

- `code` - The goal code from the Fathom UI.
- `cents` - The monetary value of the conversion.

#### Example

```ts
import { trackGoal } from "@pathscale/psc-fathom-client";

trackGoal("MY_GOAL_CODE", 100);
```

### `setSite(id: string)`

Changes the site ID at runtime.

### `blockTrackingForMe()`

Blocks tracking for the current visitor via `localStorage`.

See https://usefathom.com/docs/features/exclude.

### `enableTrackingForMe()`

Enables tracking for the current visitor.

### `isTrackingEnabled()`

Returns `true` if tracking is currently active for the visitor.

## Framework Examples

### SolidJS

```ts
import { createEffect, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import * as Fathom from "@pathscale/psc-fathom-client";

function App() {
  const location = useLocation();

  onMount(() => {
    Fathom.load("MY_FATHOM_ID", { auto: false });
  });

  createEffect(() => {
    Fathom.trackPageview({ url: location.pathname });
  });
}
```

### React Router

```jsx
import { useEffect } from "react";
import { useLocation } from "react-router";
import * as Fathom from "@pathscale/psc-fathom-client";

function FathomAnalytics() {
  const location = useLocation();

  useEffect(() => {
    Fathom.load("MY_FATHOM_ID", { auto: false });
  }, []);

  useEffect(() => {
    Fathom.trackPageview({ url: location.pathname + location.search });
  }, [location.pathname, location.search]);

  return null;
}
```

### Next.js (App Router)

```tsx
"use client";

import { load, trackPageview } from "@pathscale/psc-fathom-client";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function TrackPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    load("MY_FATHOM_ID", { auto: false });
  }, []);

  useEffect(() => {
    if (!pathname) return;
    trackPageview({
      url: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ""),
    });
  }, [pathname, searchParams]);

  return null;
}

export default function Fathom() {
  return (
    <Suspense fallback={null}>
      <TrackPageView />
    </Suspense>
  );
}
```

## How it works

This package adapts the [official Fathom script](https://cdn.usefathom.com/script.js) into a standard ESM module. The tracking logic — pixel beacons, departure pings, query string extraction, canonical URL support — is preserved. DOM `data-*` attribute parsing and SPA history patching are removed in favor of the `load()` API and framework-native routing hooks.

## License

MIT
