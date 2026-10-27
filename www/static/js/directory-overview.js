(() => {
  const summary = document.querySelector('#catalogue-summary');
  if (!summary) return;
  fetch('/directory/overview.json', {cache:'no-cache',credentials:'omit'})
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (!data || data.schema_version !== 1 || !Number.isInteger(data.software_total) || data.software_total < 0) return;
      summary.textContent = data.software_total + ' software tools and standards. European company filters available.';
      summary.hidden = false;
      for (const item of data.categories || []) {
        if (!/^[a-z0-9-]+$/.test(item.id) || !Number.isInteger(item.european_company_count)) continue;
        const link = document.querySelector('a.category-link[href="/directory/categories/' + item.id + '/"]');
        if (!link) continue;
        const count = document.createElement('small');
        count.className = 'area-count';
        count.textContent = item.european_company_count + ' European company listings';
        link.append(count);
      }
    }).catch(() => {});
})();
