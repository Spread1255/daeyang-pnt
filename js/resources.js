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

  // ---------- MSDS 표: 번호 · 구분 · 제품명 · 제품코드 · 다운로드 (검색 + 페이지) ----------
  var msdsRows = [];
  var page = 1;
  var PDF_ICON = '<svg viewBox="0 0 24 28" width="22" height="26" aria-hidden="true"><path d="M3 1h12l6 6v19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="#fff" stroke="#b9b4ad"/><path d="M15 1v6h6" fill="none" stroke="#b9b4ad"/><rect x="0" y="12" width="17" height="8" rx="1.5" fill="#d93025"/><text x="8.5" y="18.3" text-anchor="middle" font-family="Arial,sans-serif" font-size="6" font-weight="700" fill="#fff">PDF</text></svg>';

  var XLS_ICON = '<svg viewBox="0 0 24 28" width="22" height="26" aria-hidden="true"><path d="M3 1h12l6 6v19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="#fff" stroke="#b9b4ad"/><path d="M15 1v6h6" fill="none" stroke="#b9b4ad"/><rect x="0" y="12" width="17" height="8" rx="1.5" fill="#1d7a45"/><text x="8.5" y="18.3" text-anchor="middle" font-family="Arial,sans-serif" font-size="6" font-weight="700" fill="#fff">XLS</text></svg>';

  function isExcel(row) {
    return /excel|spreadsheet/.test(row.file_type || "") || /\.xlsx?$/i.test(row.file_path || "");
  }

  function msdsFiltered() {
    var q = msdsWrap.querySelector("[data-msds-search]").value.trim().toLowerCase();
    return msdsRows.filter(function (row) {
      return !q || [row.series, row.product_code, row.product_name, row.title].some(function (v) {
        return v && v.toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function pagerButton(label, target, opts) {
    var btn = el("button", "msds-page" + (opts && opts.current ? " is-current" : ""), label);
    btn.type = "button";
    if (opts && opts.aria) {
      btn.setAttribute("aria-label", opts.aria);
    }
    if (opts && opts.current) {
      btn.setAttribute("aria-current", "page");
    }
    if (opts && opts.disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", function () {
        page = target;
        paintMsds();
        msdsWrap.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
    return btn;
  }

  function paintMsds() {
    var body = msdsWrap.querySelector("[data-msds-body]");
    var size = parseInt(msdsWrap.querySelector("[data-msds-size]").value, 10) || 15;
    var pager = msdsWrap.querySelector("[data-msds-pager]");
    var list = msdsFiltered();
    var pages = Math.max(1, Math.ceil(list.length / size));
    page = Math.min(Math.max(1, page), pages);
    var slice = list.slice((page - 1) * size, page * size);

    msdsWrap.querySelector("[data-msds-count]").textContent = String(list.length);
    Array.prototype.forEach.call(msdsWrap.querySelectorAll("[data-msds-size] option"), function (opt) {
      opt.textContent = t("msds.perPage").replace("{n}", opt.value);
    });
    msdsWrap.querySelector("[data-msds-noresult]").hidden = list.length > 0;

    body.replaceChildren();
    slice.forEach(function (row) {
      var name = row.product_name || row.title;
      var tr = el("tr");
      tr.appendChild(el("td", "msds-no", String(row.no)));
      tr.appendChild(el("td", "msds-series", row.series || "-"));
      tr.appendChild(el("td", "msds-name", name));
      tr.appendChild(el("td", "msds-code", row.product_code || "-"));
      var cell = el("td", "msds-file");
      var link = el("a", "msds-pdf");
      link.href = window.DY_RESOURCE_URL(row.file_path);
      link.target = "_blank";
      link.rel = "noopener";
      link.setAttribute("aria-label", t("resources.download") + ": " + name);
      link.innerHTML = isExcel(row) ? XLS_ICON : PDF_ICON;
      cell.appendChild(link);
      tr.appendChild(cell);
      body.appendChild(tr);
    });

    pager.replaceChildren();
    if (pages > 1) {
      var start = Math.floor((page - 1) / 10) * 10 + 1;
      var end = Math.min(start + 9, pages);
      pager.appendChild(pagerButton("«", 1, { aria: "1", disabled: page === 1 }));
      pager.appendChild(pagerButton("‹", start > 1 ? start - 1 : 1, { aria: "prev", disabled: start === 1 }));
      for (var i = start; i <= end; i++) {
        pager.appendChild(pagerButton(String(i), i, { current: i === page }));
      }
      pager.appendChild(pagerButton("›", end + 1, { aria: "next", disabled: end === pages }));
      pager.appendChild(pagerButton("»", pages, { aria: String(pages), disabled: page === pages }));
    }
  }

  window.DY_SB
    .from("resources")
    .select("id, category, title, description, file_path, file_type, series, product_code, product_name, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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
        // 최근 것이 위, 번호는 올린 순서(가장 오래된 것이 1번)
        msdsRows.forEach(function (row, i) {
          row.no = msdsRows.length - i;
        });
        msdsWrap.hidden = false;
        var prep = document.querySelector("[data-resource-empty='msds']");
        if (prep) {
          prep.hidden = true;
        }
        msdsWrap.querySelector("[data-msds-search]").addEventListener("input", function () {
          page = 1;
          paintMsds();
        });
        msdsWrap.querySelector("[data-msds-size]").addEventListener("change", function () {
          page = 1;
          paintMsds();
        });
        window.addEventListener("i18n:change", paintMsds);
        paintMsds();
      }
    });
})();
