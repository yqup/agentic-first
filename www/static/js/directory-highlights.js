(() => {
  const catalogUrls = [
    "/static/agentic-tools.json",
  ];

  const residencyRoot = document.querySelector("[data-residency-watchlist]");
  const sovereignRoot = document.querySelector("[data-sovereign-ai]");

  const europeanCompanyAdditions = [
    {
      name: "Cosine",
      category: "UK / coding agents",
      summary: "Agentic software engineering system and UK sovereign AI work, including Lumen Sovereign.",
      primary_url: "https://cosine.sh/",
      data_residency: {
        label: "Company signal",
        regions: ["United Kingdom"],
      },
    },
  ];

  const sovereignAiAdditions = [
    {
      name: "Cosine",
      category: "UK sovereign AI",
      summary: "Lumen Sovereign is Cosine's planned sovereign frontier model for controlled UK training, governance, and deployment.",
      primary_url: "https://cosine.sh/lumen-sovereign",
      data_residency: {
        label: "Company signal",
        regions: ["United Kingdom"],
      },
    },
  ];

  const europeanCompanyEyebrows = {
    Cosine: "UK / coding agents",
    "Mistral AI La Plateforme": "France / AI models",
    "Adyen Agentic Commerce": "Netherlands / payments",
    Langfuse: "Germany / observability",
    "Hostinger Agentic Mail": "Lithuania / agent email",
  };

  const europeanCompanyNotes = {
    Cosine: "Company signal: UK; sovereign AI work to verify",
    "Mistral AI La Plateforme": "Company signal: Paris, France; EU default hosting",
    "Adyen Agentic Commerce": "Company signal: Amsterdam, Netherlands; Europe primary",
    Langfuse: "Company signal: Berlin, Germany; EU region or self-host",
    "Hostinger Agentic Mail": "Company signal: Lithuania; EU/US region choice to verify",
  };

  const sovereignAiEyebrows = {
    Cosine: "UK sovereign AI",
    "Mistral AI La Plateforme": "EU default",
    "Azure AI Foundry Models": "Azure geo",
    "Amazon Bedrock": "AWS region",
    "Google Gemini API / Vertex AI": "Cloud region",
    "Cohere Platform": "Private deploy",
    "Hugging Face Inference Providers": "EU/US choice",
  };

  const sovereignAiNotes = {
    Cosine: "Company signal: UK; sovereign model work to verify",
  };

  if (!window.fetch || (!residencyRoot && !sovereignRoot)) return;

  function text(value) {
    return value == null ? "" : String(value);
  }

  function labelFromCategory(value) {
    return text(value)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function residencyLine(entry) {
    const residency = entry.data_residency || {};
    const label = text(residency.label || "Residency: verify");
    const regions = Array.isArray(residency.regions) ? residency.regions.filter(Boolean) : [];
    return regions.length ? `${label}: ${regions.join(", ")}` : label;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function makeCard(entry, tone, options = {}) {
    const article = document.createElement("article");
    article.className = `tool-card ${tone || ""}`.trim();

    const category = document.createElement("span");
    category.textContent = options.eyebrows?.[entry.name] || labelFromCategory(entry.category || entry.directory_group);
    article.appendChild(category);

    const heading = document.createElement("h3");
    const url = text(entry.primary_url);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener noreferrer";
      link.textContent = text(entry.name);
      heading.appendChild(link);
    } else {
      heading.textContent = text(entry.name);
    }
    article.appendChild(heading);

    const summary = document.createElement("p");
    summary.textContent = text(entry.summary || entry.agent_native_scope);
    article.appendChild(summary);

    const small = document.createElement("small");
    small.textContent = options.notes?.[entry.name] || residencyLine(entry);
    article.appendChild(small);

    return article;
  }

  function renderCards(root, entries, tone, source, options = {}) {
    if (!root || !entries.length) return;
    clear(root);
    entries.forEach((entry) => root.appendChild(makeCard(entry, tone, options)));
    root.dataset.source = source;
  }

  function pickByName(entries, names) {
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    return names.map((name) => byName.get(name)).filter(Boolean);
  }

  function fetchCatalog(urls) {
    const [url, ...rest] = urls;
    if (!url) return Promise.resolve(null);
    return fetch(url, { cache: "no-store", credentials: "omit" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("catalog fetch failed"))))
      .then((catalog) => ({
        catalog,
        source: "snapshot-catalog",
      }))
      .catch(() => fetchCatalog(rest));
  }

  fetchCatalog(catalogUrls)
    .then((result) => {
      const entries = Array.isArray(result?.catalog?.entries) ? result.catalog.entries : [];
      if (!entries.length) return;

      renderCards(
        residencyRoot,
        europeanCompanyAdditions.concat(
          pickByName(entries, [
            "Mistral AI La Plateforme",
            "Adyen Agentic Commerce",
            "Langfuse",
            "Hostinger Agentic Mail",
          ])
        ),
        "residency",
        result.source,
        {
          eyebrows: europeanCompanyEyebrows,
          notes: europeanCompanyNotes,
        }
      );

      renderCards(
        sovereignRoot,
        sovereignAiAdditions.concat(
          pickByName(entries, [
            "Mistral AI La Plateforme",
            "Azure AI Foundry Models",
            "Amazon Bedrock",
            "Google Gemini API / Vertex AI",
            "Cohere Platform",
            "Hugging Face Inference Providers",
          ])
        ),
        "sovereign",
        result.source,
        {
          eyebrows: sovereignAiEyebrows,
          notes: sovereignAiNotes,
        }
      );
    })
    .catch(() => {});
})();
