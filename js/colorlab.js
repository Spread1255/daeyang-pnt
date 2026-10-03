(function () {
  // 컬러 연구소: 관리자 페이지에서 등록한 비교(RAL 기준 컬러 1장 — 비교 대상 3장)를 보여준다.
  // 비교 대상 3장은 같은 제품의 내부 / 외부 / 암막 사진이고, 제품 이름(cmp_name)은 아래에 한 번만 표시한다.
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

  function card(path, label, num, isRef) {
    var fig = el("figure", "lab-card" + (isRef ? " lab-card--ref" : "") + (path ? "" : " is-empty"));
    var frame = path ? el("a", "lab-frame") : el("div", "lab-frame");
    frame.appendChild(el("span", "lab-num", num));
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
    if (label) {
      fig.appendChild(el("figcaption", "", label));
    }
    return fig;
  }

  function paint() {
    wrap.replaceChildren();
    rows.forEach(function (row) {
      var entry = el("article", "lab-entry");
      entry.appendChild(el("h2", "lab-title", row.title));
      if (row.description) {
        entry.appendChild(el("p", "lab-desc", row.description));
      }
      var line = el("div", "lab-row");

      var ref = el("div", "lab-group lab-group--ref");
      ref.appendChild(el("p", "lab-group-title", t("colorlab.ral")));
      ref.appendChild(card(row.ref_path, row.ref_label, "1", true));

      var dash = el("span", "lab-dash");
      dash.setAttribute("aria-hidden", "true");

      var cmp = el("div", "lab-group lab-group--cmp");
      cmp.appendChild(el("p", "lab-group-title", t("colorlab.compare")));
      var cards = el("div", "lab-cmp-row");
      CMP.forEach(function (key, i) {
        cards.appendChild(card(row[key + "_path"], t("colorlab.cond" + (i + 1)), String(i + 1), false));
      });
      cmp.appendChild(cards);
      if (row.cmp_name) {
        cmp.appendChild(el("p", "lab-cmp-name", row.cmp_name));
      }

      line.appendChild(ref);
      line.appendChild(dash);
      line.appendChild(cmp);
      entry.appendChild(line);
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
