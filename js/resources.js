(function () {
  // 관리자 페이지에서 올린 자료(Supabase)를 인증서/확인서 페이지와 MSDS 페이지에 붙인다.
  var certGrid = document.querySelector("[data-resource-list='cert']");
  var msdsWrap = document.querySelector("[data-msds]");
  if ((!certGrid && !msdsWrap) || !window.DY_SB) {
    return;
  }

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

  function certCard(row) {
    var url = window.DY_RESOURCE_URL(row.file_path);
    var card = el("article", "cert-card");
    var media;
    if (row.file_type === "application/pdf") {
      media = el("div", "cert-media");
      var frame = document.createElement("iframe");
      frame.src = url;
      frame.title = row.title;
      frame.loading = "lazy";
      media.appendChild(frame);
    } else {
      media = el("a", "cert-media");
      media.href = url;
      media.target = "_blank";
      media.rel = "noopener";
      var img = document.createElement("img");
      img.src = url;
      img.alt = row.title;
      img.loading = "lazy";
      media.appendChild(img);
    }
    var info = el("div", "cert-info");
    info.appendChild(el("h3", "", row.title));
    if (row.description) {
      info.appendChild(el("p", "", row.description));
    }
    var open = el("a", "", t("resources.cert.viewFull"));
    open.href = url;
    open.target = "_blank";
    open.rel = "noopener";
    open.setAttribute("data-i18n", "resources.cert.viewFull");
    info.appendChild(open);
    card.appendChild(media);
    card.appendChild(info);
    return card;
  }

  // ---------- MSDS 표 + 검색 ----------
  var msdsRows = [];

  function formatDate(iso) {
    return iso ? iso.replace(/-/g, ".") : "-";
  }

  function paintMsds() {
    var body = msdsWrap.querySelector("[data-msds-body]");
    var search = msdsWrap.querySelector("[data-msds-search]");
    var count = msdsWrap.querySelector("[data-msds-count]");
    var noResult = msdsWrap.querySelector("[data-msds-noresult]");
    var q = search.value.trim().toLowerCase();
    var shown = msdsRows.filter(function (row) {
      return !q || [row.product_code, row.product_name, row.title].some(function (v) {
        return v && v.toLowerCase().indexOf(q) !== -1;
      });
    });
    body.replaceChildren();
    shown.forEach(function (row) {
      var tr = el("tr");
      tr.appendChild(el("td", "msds-code", row.product_code || "-"));
      tr.appendChild(el("td", "msds-name", row.product_name || row.title));
      tr.appendChild(el("td", "msds-date", formatDate(row.revised_on)));
      var cell = el("td", "msds-file");
      var link = el("a", "btn btn-sm", t("resources.download"));
      link.href = window.DY_RESOURCE_URL(row.file_path);
      link.target = "_blank";
      link.rel = "noopener";
      cell.appendChild(link);
      tr.appendChild(cell);
      body.appendChild(tr);
    });
    count.textContent = t("msds.count").replace("{n}", q ? shown.length + " / " + msdsRows.length : msdsRows.length);
    noResult.hidden = shown.length > 0;
  }

  window.DY_SB
    .from("resources")
    .select("category, title, description, file_path, file_type, product_code, product_name, revised_on")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .then(function (res) {
      if (res.error || !res.data) {
        return;
      }
      res.data.forEach(function (row) {
        if (row.category === "cert" && certGrid) {
          certGrid.appendChild(certCard(row));
        } else if (row.category === "msds") {
          msdsRows.push(row);
        }
      });
      if (msdsWrap && msdsRows.length) {
        msdsRows.sort(function (a, b) {
          return (a.product_code || "\uffff").localeCompare(b.product_code || "\uffff", "ko", { numeric: true });
        });
        msdsWrap.hidden = false;
        var prep = document.querySelector("[data-resource-empty='msds']");
        if (prep) {
          prep.hidden = true;
        }
        msdsWrap.querySelector("[data-msds-search]").addEventListener("input", paintMsds);
        window.addEventListener("i18n:change", paintMsds);
        paintMsds();
      }
    });
})();
