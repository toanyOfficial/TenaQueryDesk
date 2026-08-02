# Restricted UI inspection backend contract

Tena Query Desk does not expose a browser object or JavaScript evaluator to the Agent. `browser-client.ts` talks only to a separately operated, read-only browser inspection service configured by `UI_BROWSER_SERVICE_URL` and `UI_BROWSER_SERVICE_TOKEN`.

The backend must implement the fixed `/v1/sessions` endpoints used by this directory and enforce the restrictions included in each request. In particular, it must:

- create a fresh incognito browser context per session and destroy it at `maxSessionMs` even if the caller disconnects;
- deny downloads, clipboard, geolocation, camera, microphone, notifications, file access, arbitrary JavaScript, form input and form submission;
- allow navigation only to `baseUrl`, `allowedHosts` and `allowedRoutePrefixes`, while honoring blocked prefixes;
- abort third-party navigation and all mutation requests;
- issue opaque, session-local element references and classify actions from element semantics, form ownership, destination and observed handlers—not label text alone;
- return accessibility-derived metadata rather than selectors, XPath, DOM HTML, cookies, storage, request/response bodies or credentials;
- mask password and personal-data regions before creating a private screenshot artifact;
- retain screenshot artifacts for no more than the requested retention period and authorize them by the originating session/conversation;
- never return an externally accessible artifact URL.

If this backend is not configured, `get_ui_capabilities` reports browser features as unavailable and browser operations return `UI_BROWSER_NOT_AVAILABLE`. A package dependency alone is not treated as browser support.
