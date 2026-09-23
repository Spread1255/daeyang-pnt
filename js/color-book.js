(function () {
  const root = document.getElementById("color-book");
  const grid = document.getElementById("color-grid");
  if (!root) {
    return;
  }

  const PER_PAGE = 8;
  const FLIP_MS = 800;
  const single = window.matchMedia("(max-width: 700px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.innerHTML =
    '<div class="cbook-stage" tabindex="0">' +
    '<div class="cbook-book"></div>' +
    "</div>" +
    '<div class="cbook-controls">' +
    '<button type="button" class="cbook-btn" data-dir="-1" data-i18n-aria-label="colors.book.prev" aria-label="이전 장">&#8249;</button>' +
    '<span class="cbook-indicator" aria-live="polite"></span>' +
    '<button type="button" class="cbook-btn" data-dir="1" data-i18n-aria-label="colors.book.next" aria-label="다음 장">&#8250;</button>' +
    "</div>" +
    '<p class="cbook-hint" data-i18n="colors.book.hint">마우스 휠을 굴리거나 페이지를 클릭해서 한 장씩 넘겨보세요.</p>';

  if (window.I18N) {
    window.I18N.apply(root);
  }

  const stage = root.querySelector(".cbook-stage");
  const book = root.querySelector(".cbook-book");
  const indicator = root.querySelector(".cbook-indicator");
  const prevBtn = root.querySelector('[data-dir="-1"]');
  const nextBtn = root.querySelector('[data-dir="1"]');

  let items = [];
  let filterKey = "";
  let leaves = [];
  let current = 0;
  let max = 0;
  let isSingle = single.matches;

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function seriesName(id) {
    return window.I18N ? window.I18N.seriesName(id) : (window.SERIES_NAMES[id] || "");
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function pad3(n) {
    return ("00" + n).slice(-3);
  }

  function makePages() {
    const pages = [{ type: "cover" }, { type: "intro" }];
    if (!items.length) {
      pages.push({ type: "empty" });
    }
    for (let i = 0; i < items.length; i += PER_PAGE) {
      pages.push({ type: "chips", items: items.slice(i, i + PER_PAGE), num: i / PER_PAGE + 1 });
    }
    pages.push({ type: "note" });
    if (!isSingle && pages.length % 2 === 0) {
      pages.push({ type: "blank" });
    }
    pages.push({ type: "back" });
    return pages;
  }

  function head() {
    return '<header class="cbook-page-head"><span>DAEYANG P&amp;T</span><span>COLOR BOOK</span></header>';
  }

  function coverStripe() {
    const seen = {};
    const picks = [];
    items.forEach(function (item) {
      if (!seen[item.color] && picks.length < 12) {
        seen[item.color] = true;
        picks.push(item);
      }
    });
    return picks.map(function (item) {
      return '<span style="background-color:' + item.hex + '"></span>';
    }).join("");
  }

  function pageHTML(page, side) {
    switch (page.type) {
      case "cover":
        return (
          '<div class="cbook-page cbook-cover">' +
          '<img class="cbook-cover-logo" src="images/logo-dyp.png" alt="">' +
          '<div class="cbook-cover-title"><p>COLOR<br>BOOK</p><span>' + esc(t("colors.book.subtitle")) + "</span></div>" +
          '<div class="cbook-cover-stripe">' + coverStripe() + "</div>" +
          '<p class="cbook-cover-foot">DAEYANG P&amp;T · ' + items.length + " COLORS</p>" +
          "</div>"
        );
      case "intro": {
        const counts = {};
        items.forEach(function (item) {
          counts[item.series] = (counts[item.series] || 0) + 1;
        });
        const rows = Object.keys(counts).sort().map(function (s) {
          return "<li><strong>DY#" + s + "</strong><span>" + esc(seriesName(s)) + "</span><em>" + esc(t("colors.count").replace("{n}", counts[s])) + "</em></li>";
        }).join("");
        return (
          '<div class="cbook-page cbook-page--' + side + '">' + head() +
          '<div class="cbook-text">' +
          "<h3>" + esc(t("colors.book.introTitle")) + "</h3>" +
          "<p>" + esc(t("colors.book.introBody")) + "</p>" +
          "<h4>" + esc(t("colors.book.series")) + "</h4>" +
          '<ul class="cbook-series">' + rows + "</ul>" +
          "</div></div>"
        );
      }
      case "chips":
        return (
          '<div class="cbook-page cbook-page--' + side + '">' + head() +
          '<div class="cbook-chips">' +
          page.items.map(function (item) {
            return (
              '<figure class="cbook-chip">' +
              '<span class="cbook-chip-color" role="img" aria-label="' + esc(item.code) + '" style="background-color:' + item.hex +
              ";background-image:url(images/chips/" + pad3(item.no) + '.jpg)"></span>' +
              "<figcaption><strong>" + esc(item.code) + "</strong><span>" + esc(item.name) + "</span></figcaption>" +
              "</figure>"
            );
          }).join("") +
          "</div>" +
          '<footer class="cbook-page-foot">' + page.num + "</footer>" +
          "</div>"
        );
      case "empty":
        return '<div class="cbook-page cbook-page--' + side + '">' + head() + '<div class="cbook-text cbook-text--center"><p>' + esc(t("colors.empty")) + "</p></div></div>";
      case "note":
        return (
          '<div class="cbook-page cbook-page--' + side + '">' + head() +
          '<div class="cbook-text cbook-text--center"><h3>' + esc(t("colors.book.noteTitle")) + "</h3><p>" + esc(t("colors.note")) + "</p></div></div>"
        );
      case "back":
        return (
          '<div class="cbook-page cbook-cover cbook-cover--back">' +
          '<img class="cbook-cover-logo" src="images/logo-dyp.png" alt="">' +
          '<div class="cbook-back-info"><strong>대양피엔티㈜</strong>' +
          "<span>경기도 김포시 하성면 애기봉로 774번길 39-17,22</span>" +
          "<span>TEL 031)987-8587 · FAX 031)982-8587</span></div>" +
          "</div>"
        );
      default:
        return '<div class="cbook-page cbook-page--' + side + '"></div>';
    }
  }

  function build(target) {
    isSingle = single.matches;
    const pages = makePages();
    const pairs = [];
    if (isSingle) {
      pages.forEach(function (p) {
        pairs.push([p, { type: "blank" }]);
      });
    } else {
      for (let i = 0; i < pages.length; i += 2) {
        pairs.push([pages[i], pages[i + 1]]);
      }
    }
    book.classList.add("no-anim");
    book.innerHTML = pairs.map(function (pair) {
      return (
        '<div class="cbook-leaf">' +
        '<div class="cbook-face cbook-face--front">' + pageHTML(pair[0], "right") + "</div>" +
        '<div class="cbook-face cbook-face--back">' + pageHTML(pair[1], "left") + "</div>" +
        "</div>"
      );
    }).join("");
    leaves = Array.prototype.slice.call(book.children);
    max = isSingle ? leaves.length - 1 : leaves.length;
    current = Math.max(0, Math.min(max, target));
    update();
    void book.offsetWidth;
    book.classList.remove("no-anim");
  }

  function applyZ() {
    const n = leaves.length;
    leaves.forEach(function (leaf, i) {
      if (leaf.classList.contains("is-turning")) {
        return;
      }
      leaf.style.zIndex = i < current ? i + 1 : n - i;
    });
  }

  function update() {
    leaves.forEach(function (leaf, i) {
      leaf.classList.toggle("is-flipped", i < current);
    });
    applyZ();
    book.classList.toggle("is-closed-front", !isSingle && current === 0);
    book.classList.toggle("is-closed-back", !isSingle && current === max);
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === max;
    indicator.textContent = current + 1 + " / " + (max + 1);
  }

  function canGo(dir) {
    return dir > 0 ? current < max : current > 0;
  }

  let lockedUntil = 0;

  function go(dir) {
    if (!canGo(dir) || Date.now() < lockedUntil) {
      return;
    }
    lockedUntil = Date.now() + (reduceMotion ? 150 : FLIP_MS * 0.8);
    const leaf = leaves[dir > 0 ? current : current - 1];
    current += dir;
    leaf.classList.add("is-turning");
    leaf.style.zIndex = leaves.length + 2;
    update();
    window.setTimeout(function () {
      leaf.classList.remove("is-turning");
      applyZ();
    }, reduceMotion ? 0 : FLIP_MS);
  }

  prevBtn.addEventListener("click", function () {
    go(-1);
  });
  nextBtn.addEventListener("click", function () {
    go(1);
  });

  let wheelAcc = 0;
  stage.addEventListener("wheel", function (e) {
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (!dir || !canGo(dir)) {
      wheelAcc = 0;
      return;
    }
    e.preventDefault();
    if (Date.now() < lockedUntil) {
      wheelAcc = 0;
      return;
    }
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) >= 30) {
      wheelAcc = 0;
      go(dir);
    }
  }, { passive: false });

  let downX = null;
  stage.addEventListener("pointerdown", function (e) {
    downX = e.clientX;
  });
  stage.addEventListener("pointerup", function (e) {
    if (downX === null || !e.target.closest(".cbook-leaf")) {
      downX = null;
      return;
    }
    const dx = e.clientX - downX;
    downX = null;
    if (Math.abs(dx) > 40) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (current === 0) {
      go(1);
    } else if (current === max) {
      go(-1);
    } else {
      const rect = book.getBoundingClientRect();
      go(e.clientX >= rect.left + rect.width / 2 ? 1 : -1);
    }
  });

  stage.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(-1);
    }
  });

  single.addEventListener("change", function () {
    const pageIndex = isSingle ? current : current * 2;
    build(single.matches ? pageIndex : Math.round(pageIndex / 2));
  });

  // 보기 전환 (컬러북 / 목록)
  const toggle = document.querySelector(".view-toggle");
  function setView(view) {
    root.hidden = view !== "book";
    if (grid) {
      grid.hidden = view === "book";
    }
    if (toggle) {
      toggle.querySelectorAll("button").forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(btn.dataset.view === view));
      });
    }
    try {
      localStorage.setItem("dyp.colorsView", view);
    } catch (err) {}
  }
  if (toggle) {
    toggle.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-view]");
      if (btn) {
        setView(btn.dataset.view);
      }
    });
  }
  let savedView = "book";
  try {
    savedView = localStorage.getItem("dyp.colorsView") || "book";
  } catch (err) {}
  setView(savedView);

  window.ColorBook = {
    render: function (nextItems, nextKey) {
      items = nextItems;
      let target = current;
      if (nextKey !== filterKey) {
        target = nextKey ? (isSingle ? 2 : 1) : 0;
        filterKey = nextKey;
      }
      build(target);
    }
  };
})();
