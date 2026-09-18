(function () {
  const grid = document.getElementById("catalog-grid");
  const functional = document.getElementById("catalog-functional");
  const searchEl = document.getElementById("catalog-search");
  const countEl = document.getElementById("catalog-count");
  const titleEl = document.getElementById("catalog-title");
  const copyEl = document.getElementById("catalog-copy");
  const enEl = document.getElementById("catalog-en");
  const moreEl = document.getElementById("catalog-more");
  const tabs = document.querySelectorAll(".catalog-tab");
  if (!grid || !window.COLOR_CHART) {
    return;
  }

  const CATS = {
    all: {
      series: null,
      href: "products.html",
      en: "All",
      title: "home.catalog.allTitle",
      copy: "home.catalog.allCopy"
    },
    interior: {
      series: ["1"],
      href: "product-interior.html",
      enKey: "products.interior.en",
      title: "products.interior.title",
      copy: "products.interior.lede"
    },
    exterior: {
      series: ["2"],
      href: "product-exterior.html",
      enKey: "products.exterior.en",
      title: "products.exterior.title",
      copy: "products.exterior.lede"
    },
    pattern: {
      series: ["3", "4", "5", "6"],
      href: "product-pattern.html",
      enKey: "products.pattern.en",
      title: "products.pattern.title",
      copy: "products.pattern.lede"
    },
    functional: {
      series: [],
      href: "product-functional.html",
      enKey: "products.functional.en",
      title: "products.functional.title",
      copy: "products.functional.lede",
      noChips: true
    }
  };

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

  let currentCat = "all";

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function seriesName(id) {
    return window.I18N ? window.I18N.seriesName(id) : (window.SERIES_NAMES[id] || "");
  }

  function colorName(code) {
    return window.I18N ? window.I18N.colorName(code) : (window.COLOR_NAMES[code] || "");
  }

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

  function setCat(cat) {
    if (!CATS[cat]) {
      cat = "all";
    }
    currentCat = cat;
    tabs.forEach(function (tab) {
      const on = tab.getAttribute("data-cat") === cat;
      tab.setAttribute("aria-selected", String(on));
    });
    render();
  }

  function render() {
    const cat = CATS[currentCat];
    const q = (searchEl.value || "").trim().toLowerCase();

    enEl.textContent = cat.enKey ? t(cat.enKey) : cat.en;
    titleEl.textContent = t(cat.title);
    copyEl.textContent = t(cat.copy);
    moreEl.setAttribute("href", cat.href);

    const toolbar = document.querySelector(".catalog-toolbar");

    if (cat.noChips) {
      grid.hidden = true;
      functional.hidden = false;
      if (toolbar) {
        toolbar.hidden = true;
      }
      countEl.textContent = "";
      grid.replaceChildren();
      return;
    }

    functional.hidden = true;
    grid.hidden = false;
    if (toolbar) {
      toolbar.hidden = false;
    }

    const filtered = items.filter(function (item) {
      if (cat.series && cat.series.indexOf(item.series) === -1) {
        return false;
      }
      if (q && haystack(item).indexOf(q) === -1) {
        return false;
      }
      return true;
    });

    countEl.textContent = t("colors.count").replace("{n}", filtered.length);
    grid.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent = t("home.catalog.empty");
      grid.appendChild(empty);
      return;
    }

    filtered.forEach(function (item) {
      const link = document.createElement("a");
      link.className = "swatch catalog-chip";
      link.href = "shop.html?series=" + encodeURIComponent(item.series) +
        "&color=" + encodeURIComponent(item.code);
      link.innerHTML =
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
      grid.appendChild(link);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setCat(tab.getAttribute("data-cat"));
    });
  });
  searchEl.addEventListener("input", render);
  window.addEventListener("i18n:change", render);

  const params = new URLSearchParams(window.location.search);
  const initial = params.get("cat");
  if (initial && CATS[initial]) {
    setCat(initial);
  } else {
    render();
  }
})();
