(function () {
  const grid = document.getElementById("color-grid");
  const countEl = document.getElementById("color-count");
  const seriesSel = document.getElementById("filter-series");
  const colorSel = document.getElementById("filter-color");
  const searchEl = document.getElementById("filter-search");
  if (!grid || !window.COLOR_CHART) {
    return;
  }

  const items = window.COLOR_CHART.map(function (row) {
    const code = row[1];
    const match = code.match(/^DY#(\d+)-([A-Z]{2})(\d+)$/);
    return {
      no: row[0],
      code: code,
      name: row[2],
      series: match ? match[1] : "",
      color: match ? match[2] : "",
      img: "images/chips/" + String(row[0]).padStart(3, "0") + ".jpg"
    };
  });

  const colorKeys = Object.keys(window.COLOR_NAMES);

  function fillColorOptions() {
    const current = colorSel.value;
    while (colorSel.options.length > 1) {
      colorSel.remove(1);
    }
    colorKeys.forEach(function (key) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key + " · " + (window.I18N ? window.I18N.colorName(key) : window.COLOR_NAMES[key]);
      colorSel.appendChild(opt);
    });
    colorSel.value = current;
  }
  fillColorOptions();

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function seriesName(id) {
    return window.I18N ? window.I18N.seriesName(id) : (window.SERIES_NAMES[id] || "");
  }

  function colorName(code) {
    return window.I18N ? window.I18N.colorName(code) : (window.COLOR_NAMES[code] || "");
  }

  function render() {
    const series = seriesSel.value;
    const color = colorSel.value;
    const q = (searchEl.value || "").trim().toLowerCase();
    const filtered = items.filter(function (item) {
      if (series && item.series !== series) {
        return false;
      }
      if (color && item.color !== color) {
        return false;
      }
      if (q && (item.code + " " + item.name).toLowerCase().indexOf(q) === -1) {
        return false;
      }
      return true;
    });
    countEl.textContent = t("colors.count").replace("{n}", filtered.length);
    grid.replaceChildren();
    filtered.forEach(function (item) {
      const article = document.createElement("article");
      article.className = "swatch";
      article.innerHTML =
        '<img src="' + item.img + '" alt="' + item.code + '">' +
        '<p class="swatch-code">' + item.code + "</p>" +
        '<p class="swatch-meta">' +
        seriesName(item.series) +
        " · " +
        item.color +
        " " +
        colorName(item.color) +
        "</p>" +
        '<p class="swatch-name">' + item.name + "</p>";
      grid.appendChild(article);
    });
  }

  seriesSel.addEventListener("change", render);
  colorSel.addEventListener("change", render);
  searchEl.addEventListener("input", render);
  window.addEventListener("i18n:change", function () {
    fillColorOptions();
    render();
  });

  const params = new URLSearchParams(window.location.search);
  const initial = params.get("q");
  if (initial) {
    searchEl.value = initial;
  }

  render();
})();
