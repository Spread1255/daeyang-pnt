(function () {
  // 컬러 연구소: 관리자 페이지에서 등록한 비교를 보여준다.
  // RAL 기준 컬러 1장을 비교 사진 3장(내부 / 외부 / 암막)과 각각 붙여 3쌍으로 보여주고,
  // 제품 이름(cmp_name)은 아래에 한 번만 표시한다.
  var wrap = document.querySelector("[data-colorlab]");
  if (!wrap || !window.DY_SB) {
    return;
  }

  var CMP = ["cmp1", "cmp2", "cmp3"];
  var rows = [];

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  }

  function card(path, label, isRef) {
    var fig = el("figure", "lab-card" + (isRef ? " lab-card--ref" : "") + (path ? "" : " is-empty"));
    var frame = path ? el("a", "lab-frame") : el("div", "lab-frame");
    if (path) {
      var url = window.DY_RESOURCE_URL(path);
      frame.href = url;
      frame.target = "_blank";
      frame.rel = "noopener";
      var img = el("img");
      img.src = url;
      img.alt = label || "";
      img.loading = "lazy";
      frame.appendChild(img);
    }
    fig.appendChild(frame);
    fig.appendChild(el("figcaption", "", label));
    return fig;
  }

  // 한 쌍: RAL 컬러 카드와 비교 카드(내부/외부/암막)를 딱 붙여 놓는다.
  function pair(row, key, i) {
    var cond = t("colorlab.cond" + (i + 1));
    var box = el("section", "lab-pair");
    var head = el("h3", "lab-pair-head");
    head.appendChild(el("span", "lab-num", String(i + 1)));
    head.appendChild(document.createTextNode(t("colorlab.ral") + " + " + cond));
    var cards = el("div", "lab-pair-cards");
    cards.appendChild(card(row.ref_path, row.ref_label || t("colorlab.ral"), true));
    cards.appendChild(card(row[key + "_path"], cond, false));
    box.appendChild(head);
    box.appendChild(cards);
    return box;
  }

  function paint() {
    wrap.replaceChildren();
    rows.forEach(function (row) {
      var entry = el("article", "lab-entry");
      entry.appendChild(el("h2", "lab-title", row.title));
      if (row.description) {
        entry.appendChild(el("p", "lab-desc", row.description));
      }
      var pairs = el("div", "lab-pairs");
      CMP.forEach(function (key, i) {
        pairs.appendChild(pair(row, key, i));
      });
      entry.appendChild(pairs);
      if (row.cmp_name) {
        entry.appendChild(el("p", "lab-cmp-name", row.cmp_name));
      }
      wrap.appendChild(entry);
    });
  }

  window.DY_SB
    .from("colorlab_entries")
    .select("id, title, description, ref_path, ref_label, cmp1_path, cmp2_path, cmp3_path, cmp_name")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .then(function (res) {
      if (res.error || !res.data || !res.data.length) {
        return;
      }
      rows = res.data;
      var empty = document.querySelector("[data-colorlab-empty]");
      if (empty) {
        empty.hidden = true;
      }
      wrap.hidden = false;
      paint();
      window.addEventListener("i18n:change", paint);
    });
})();
