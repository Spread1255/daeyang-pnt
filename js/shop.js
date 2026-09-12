(function () {
  const seriesEl = document.getElementById("shop-series");
  const packEl = document.getElementById("shop-pack");
  const qtyEl = document.getElementById("shop-qty");
  const colorEl = document.getElementById("shop-color");
  const infoEl = document.getElementById("shop-info");
  const compareEl = document.getElementById("shop-compare");
  const captionEl = document.getElementById("shop-compare-caption");
  const buyForm = document.getElementById("shop-form");
  const targets = window.COMPARE_TARGETS || [];
  if (!seriesEl || !window.DAEYANG_PRICES) {
    return;
  }

  function won(n) {
    return n.toLocaleString("ko-KR") + "원";
  }

  function fillColors(series) {
    if (!colorEl || !window.COLOR_CHART) {
      return;
    }
    const current = colorEl.value;
    colorEl.replaceChildren();
    const any = document.createElement("option");
    any.value = "";
    any.textContent = "색상 미지정";
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
    const title = document.createElement("p");
    title.className = "shop-info-title";
    title.textContent = s.item.code + " " + s.item.name;
    infoEl.appendChild(title);
    addInfo("용도", s.item.use);
    addInfo("마감", s.item.finish);
    addInfo("설명", s.item.info);
    addInfo("포장", s.pack === "20" ? "소량 20kg" : "산업 300kg");
    addInfo("수량", s.qty + "포 · " + s.kg.toLocaleString("ko-KR") + "kg");
    addInfo("금액", "선접수 후 통보");
  }

  function renderCompare(s) {
    const ranked = targets.map(function (target) {
      const price = target.prices[s.series];
      if (!price) {
        return null;
      }
      const theirUnit = s.pack === "20" ? price.pack20 : price.bulk;
      return {
        target: target,
        theirUnit: theirUnit,
        theirTotal: theirUnit * s.kg,
        gap: Math.abs(theirUnit - s.unit)
      };
    }).filter(Boolean).sort(function (a, b) {
      return b.gap - a.gap;
    }).slice(0, 5);

    if (captionEl) {
      captionEl.textContent = "국내 " + targets.length + "종 중 시세 차이가 큰 5종 · " +
        s.item.code + " " + (s.pack === "20" ? "20kg" : "300kg");
    }

    compareEl.replaceChildren();
    ranked.forEach(function (item, index) {
      const row = document.createElement("article");
      row.className = "shop-compare-row is-on";
      const head = document.createElement("div");
      head.className = "shop-compare-head";
      const title = document.createElement("strong");
      title.textContent = (index + 1) + ". " + item.target.name;
      const meta = document.createElement("span");
      meta.textContent = item.target.note;
      head.appendChild(title);
      head.appendChild(meta);
      const nums = document.createElement("div");
      nums.className = "shop-compare-nums";
      const theirs = document.createElement("p");
      const unitLabel = document.createElement("em");
      unitLabel.textContent = won(item.theirUnit) + "/kg";
      const totalLabel = document.createElement("small");
      totalLabel.textContent = won(item.theirTotal);
      theirs.appendChild(unitLabel);
      theirs.appendChild(totalLabel);
      nums.appendChild(theirs);
      row.appendChild(head);
      row.appendChild(nums);
      compareEl.appendChild(row);
    });
  }

  function render() {
    const s = state();
    fillColors(s.series);
    renderInfo(s);
    renderCompare(s);
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
      product: s.item.code + " " + s.item.name,
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
})();
