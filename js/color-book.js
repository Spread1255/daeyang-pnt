(function () {
  const root = document.getElementById("color-book");
  const grid = document.getElementById("color-grid");
  if (!root) {
    return;
  }

  const PAGE_COUNT = 12;
  const PAGES = [];
  for (let i = 1; i <= PAGE_COUNT; i++) {
    const n = ("0" + i).slice(-2);
    PAGES.push({
      src: "images/colorbook/page-" + n + ".jpg",
      alt: i === 1 ? "대양피엔티 디지털 컬러북 표지" : i === PAGE_COUNT ? "대양피엔티 디지털 컬러북 뒤표지" : "대양피엔티 디지털 컬러북 " + i + "페이지"
    });
  }

  const FLIP_MS = 800;
  const single = window.matchMedia("(max-width: 700px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.innerHTML =
    '<p class="cbook-disclaimer" data-i18n="colors.book.disclaimer">※ 본 색상은 웹 컬러로, 모니터에 따라 실제 도료 색과 다르게 보일 수 있습니다. 반드시 실제 칼라북으로 재확인하시기 바랍니다.</p>' +
    '<div class="cbook-stage" tabindex="0">' +
    '<div class="cbook-book">' +
    '<div class="cbook-leaves"></div>' +
    '<div class="cbook-spine cbook-spine--front"></div>' +
    '<div class="cbook-spine cbook-spine--back"></div>' +
    "</div>" +
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
  const leavesRoot = root.querySelector(".cbook-leaves");
  const indicator = root.querySelector(".cbook-indicator");
  const prevBtn = root.querySelector('[data-dir="-1"]');
  const nextBtn = root.querySelector('[data-dir="1"]');

  let leaves = [];
  let current = 0;
  let max = 0;
  let isSingle = single.matches;

  function pageHTML(page) {
    if (!page) {
      return '<div class="cbook-page"></div>';
    }
    return '<div class="cbook-page"><img src="' + page.src + '" alt="' + page.alt + '" loading="lazy"></div>';
  }

  function build(target) {
    isSingle = single.matches;
    const pairs = [];
    if (isSingle) {
      PAGES.forEach(function (p) {
        pairs.push([p, null]);
      });
    } else {
      for (let i = 0; i < PAGES.length; i += 2) {
        pairs.push([PAGES[i], PAGES[i + 1]]);
      }
    }
    book.classList.add("no-anim");
    leavesRoot.innerHTML = pairs.map(function (pair) {
      return (
        '<div class="cbook-leaf">' +
        '<div class="cbook-face cbook-face--front">' + pageHTML(pair[0]) + "</div>" +
        '<div class="cbook-face cbook-face--back">' + pageHTML(pair[1]) + "</div>" +
        "</div>"
      );
    }).join("");
    leaves = Array.prototype.slice.call(leavesRoot.children);
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

  build(0);

  window.ColorBook = {
    render: function () {}
  };
})();
