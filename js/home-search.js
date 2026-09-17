(function () {
  const input = document.getElementById("home-color-search");
  const results = document.getElementById("home-color-results");
  const countEl = document.getElementById("home-color-count");
  const more = document.querySelector(".color-finder-more");
  if (!input || !results || !window.COLOR_CHART) {
    return;
  }

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function seriesName(id) {
    return window.I18N ? window.I18N.seriesName(id) : (window.SERIES_NAMES[id] || "");
  }

  function colorName(code) {
    return window.I18N ? window.I18N.colorName(code) : (window.COLOR_NAMES[code] || "");
  }

  const items = window.COLOR_CHART.map(function (row) {
    const code = row[1];
    const match = code.match(/^DY#(\d+)-([A-Z]{2})(\d+)$/);
    const series = match ? match[1] : "";
    const color = match ? match[2] : "";
    return {
      no: row[0],
      code: code,
      name: row[2],
      series: series,
      color: color,
      img: "images/chips/" + String(row[0]).padStart(3, "0") + ".jpg"
    };
  });

  function haystack(item) {
    return [
      item.code,
      item.name,
      seriesName(item.series),
      item.color,
      colorName(item.color),
      "DY#" + item.series
    ].join(" ").toLowerCase();
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    const href = q ? "colors.html?q=" + encodeURIComponent(query.trim()) : "colors.html";
    more.setAttribute("href", href);

    if (!q) {
      countEl.textContent = "";
      results.replaceChildren();
      results.hidden = true;
      return;
    }

    const filtered = items.filter(function (item) {
      return haystack(item).indexOf(q) !== -1;
    });

    countEl.textContent = t("colors.count").replace("{n}", filtered.length);
    results.hidden = false;
    results.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "color-finder-empty";
      empty.textContent = t("colors.empty");
      results.appendChild(empty);
      return;
    }

    filtered.slice(0, 8).forEach(function (item) {
      const link = document.createElement("a");
      link.className = "color-finder-item";
      link.href = "shop.html?series=" + encodeURIComponent(item.series) +
        "&color=" + encodeURIComponent(item.code);
      link.innerHTML =
        '<img src="' + item.img + '" alt="">' +
        '<span class="color-finder-item-text">' +
        '<strong>' + item.code + "</strong>" +
        '<em>' + item.name + "</em>" +
        '<small>' + seriesName(item.series) + " · " + item.color + " " + colorName(item.color) + "</small>" +
        "</span>";
      results.appendChild(link);
    });
  }

  input.addEventListener("input", function () {
    render(input.value);
  });
  window.addEventListener("i18n:change", function () {
    render(input.value);
  });
})();
