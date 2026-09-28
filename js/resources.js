(function () {
  // 관리자 페이지에서 올린 자료(Supabase)를 인증서/확인서 페이지와 MSDS 페이지에 붙인다.
  var certGrid = document.querySelector("[data-resource-list='cert']");
  var msdsList = document.querySelector("[data-resource-list='msds']");
  if ((!certGrid && !msdsList) || !window.DY_SB) {
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

  function fileItem(row) {
    var url = window.DY_RESOURCE_URL(row.file_path);
    var li = el("li");
    var text = el("div", "file-list-text");
    text.appendChild(el("strong", "", row.title));
    if (row.description) {
      text.appendChild(el("span", "", row.description));
    }
    var link = el("a", "btn btn-sm", t("resources.download"));
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("data-i18n", "resources.download");
    li.appendChild(text);
    li.appendChild(link);
    return li;
  }

  window.DY_SB
    .from("resources")
    .select("category, title, description, file_path, file_type")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .then(function (res) {
      if (res.error || !res.data) {
        return;
      }
      res.data.forEach(function (row) {
        if (row.category === "cert" && certGrid) {
          certGrid.appendChild(certCard(row));
        } else if (row.category === "msds" && msdsList) {
          msdsList.appendChild(fileItem(row));
        }
      });
      if (msdsList && msdsList.children.length) {
        msdsList.hidden = false;
        var prep = document.querySelector("[data-resource-empty='msds']");
        if (prep) {
          prep.hidden = true;
        }
      }
    });
})();
