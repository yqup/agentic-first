(() => {
  const currentScript = document.currentScript;
  const configUrl = currentScript?.dataset.config || "/matomo-config.json";

  function cleanUrl(value) {
    if (!value || typeof value !== "string") return "";
    try {
      const url = new URL(value, window.location.href);
      if (url.protocol !== "https:") return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function matomoScriptUrl(config, trackerUrl) {
    const explicit = cleanUrl(config.scriptUrl);
    if (explicit) return explicit;
    try {
      const url = new URL(trackerUrl);
      url.pathname = url.pathname.replace(/matomo\.php$/, "matomo.js");
      return url.href;
    } catch {
      return "";
    }
  }

  function allowedHost(config) {
    const hostnames = Array.isArray(config.hostnames)
      ? config.hostnames.map((host) => String(host).trim().toLowerCase()).filter(Boolean)
      : [];
    return hostnames.length === 0 || hostnames.includes(window.location.hostname.toLowerCase());
  }

  function shouldDelayNavigation(event, link) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target.toLowerCase() !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    try {
      const url = new URL(link.href, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function enableMatomo(config) {
    if (!config || config.enabled === false || !allowedHost(config)) return;
    const trackerUrl = cleanUrl(config.trackerUrl);
    const siteId = String(config.siteId || "").trim();
    if (!trackerUrl || !siteId) return;

    window._paq = window._paq || [];
    window._paq.push(["setTrackerUrl", trackerUrl]);
    window._paq.push(["setSiteId", siteId]);
    window._paq.push(["disableCookies"]);
    window._paq.push(["trackPageView"]);
    window._paq.push(["enableLinkTracking"]);

    document.addEventListener("click", (event) => {
      const link = event.target?.closest?.("a[data-funnel-stage]");
      if (!link) return;
      const href = cleanUrl(link.href);
      const source = link.dataset.funnelSource || window.location.hostname;
      const campaign = link.dataset.funnelCampaign || "";
      const content = link.dataset.funnelContent || link.textContent?.trim() || link.href;
      const category = link.dataset.funnelCategory || "Source site funnel";
      window._paq.push([
        "trackEvent",
        category,
        link.dataset.funnelStage || "source_to_tonywood_advisory",
        [source, campaign, content].filter(Boolean).join(" | "),
      ]);
      if (href) window._paq.push(["trackLink", href, "link"]);
      if (!shouldDelayNavigation(event, link)) return;
      event.preventDefault();
      window.setTimeout(() => {
        window.location.href = link.href;
      }, 180);
    });

    const scriptUrl = matomoScriptUrl(config, trackerUrl);
    if (!scriptUrl) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = scriptUrl;
    document.head.appendChild(script);
  }

  fetch(configUrl, { cache: "no-store", credentials: "omit" })
    .then((response) => (response.ok ? response.json() : null))
    .then(enableMatomo)
    .catch(() => {});
})();
