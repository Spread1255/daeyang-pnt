(function () {
  const seriesEl = document.getElementById("shop-series");
  const packEl = document.getElementById("shop-pack");
  const qtyEl = document.getElementById("shop-qty");
  const colorEl = document.getElementById("shop-color");
  const infoEl = document.getElementById("shop-info");
  const buyForm = document.getElementById("shop-form");
  if (!seriesEl || !window.DAEYANG_PRICES) {
    return;
  }

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function fillColors(series) {
    if (!colorEl || !window.COLOR_CHART) {
      return;
    }
    const current = colorEl.value;
    colorEl.replaceChildren();
    const any = document.createElement("option");
    any.value = "";
    any.textContent = t("shop.color.unspecified");
    colorEl.appendChild(any);
    window.COLOR_CHART.forEach(function (row) {
      const code = row[1];
      const match = code.match(/^DY#(\d+)-/);
      if (match && match[1] === series) {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = code + " · " + row[2];
        colorEl.appendChild(opt);
      }
    });
    const stillThere = Array.prototype.some.call(colorEl.options, function (opt) {
      return opt.value === current;
    });
    if (stillThere) {
      colorEl.value = current;
    }
  }

  function state() {
    const series = seriesEl.value;
    const pack = packEl.value;
    const qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
    const item = window.DAEYANG_PRICES[series];
    const kgEach = pack === "20" ? 20 : 300;
    const kg = kgEach * qty;
    const unit = pack === "20" ? item.pack20 : item.bulk;
    return { series: series, pack: pack, qty: qty, item: item, kg: kg, unit: unit };
  }

  function addInfo(label, value) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.appendChild(dt);
    row.appendChild(dd);
    infoEl.appendChild(row);
  }

  function renderInfo(s) {
    infoEl.replaceChildren();
    const seriesName = window.I18N ? window.I18N.seriesName(s.series) : s.item.name;
    const use = window.I18N ? window.I18N.priceUse(s.series) : s.item.use;
    const finish = window.I18N ? window.I18N.priceFinish(s.series) : s.item.finish;
    const info = window.I18N ? window.I18N.priceInfo(s.series) : s.item.info;
    const pack = t(s.pack === "20" ? "shop.pack.20" : "shop.pack.300");
    const title = document.createElement("p");
    title.className = "shop-info-title";
    title.textContent = s.item.code + " " + seriesName;
    infoEl.appendChild(title);
    addInfo(t("shop.info.use"), use);
    addInfo(t("shop.info.finish"), finish);
    addInfo(t("shop.info.desc"), info);
    addInfo(t("shop.info.pack"), pack);
    const locale = window.I18N ? { ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN" }[window.I18N.lang()] : "ko-KR";
    addInfo(t("shop.info.qty"), t("shop.info.qtyValue").replace("{qty}", s.qty).replace("{kg}", s.kg.toLocaleString(locale)));
    addInfo(t("shop.info.price"), t("shop.info.priceValue"));
  }

  function render() {
    const s = state();
    fillColors(s.series);
    renderInfo(s);
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("series") && window.DAEYANG_PRICES[params.get("series")]) {
    seriesEl.value = params.get("series");
  }
  if (params.get("pack") === "20" || params.get("pack") === "300") {
    packEl.value = params.get("pack");
  }
  if (params.get("qty")) {
    qtyEl.value = params.get("qty");
  }

  ["change", "input"].forEach(function (evt) {
    seriesEl.addEventListener(evt, render);
    packEl.addEventListener(evt, render);
    qtyEl.addEventListener(evt, render);
  });

  buyForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const s = state();
    const color = colorEl ? colorEl.value : "";
    const quote = {
      product: s.item.code + " " + (window.I18N ? window.I18N.seriesName(s.series) : s.item.name),
      series: s.series,
      pack: s.pack,
      qty: s.qty,
      kg: s.kg,
      color: color,
      at: new Date().toISOString()
    };
    localStorage.setItem("daeyang.pnt.quote", JSON.stringify(quote));
    const q = new URLSearchParams();
    q.set("product", quote.product);
    q.set("pack", s.pack);
    q.set("qty", String(s.qty));
    q.set("kg", String(s.kg));
    q.set("preorder", "1");
    if (color) {
      q.set("color", color);
    }
    window.location.href = "contact.html?" + q.toString();
  });

  render();
  if (params.get("color") && colorEl) {
    colorEl.value = params.get("color");
  }

  window.addEventListener("i18n:change", render);
})();
