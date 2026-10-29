(function () {
  const root = document.getElementById("color-book");
  if (!root) {
    return;
  }

  const CHART = window.COLOR_CHART || [];

  // ver.4(최신): 페이지 5~12의 칩을 차례로 이으면 COLOR_CHART 순서와 같다.
  const V4_CHIPS = window.COLORBOOK_CHIPS || {};
  const v4Start = {};
  let chipCount = 0;
  Object.keys(V4_CHIPS).map(Number).sort(function (a, b) { return a - b; }).forEach(function (num) {
    v4Start[num] = chipCount;
    chipCount += V4_CHIPS[num].length;
  });

  // ver.3(이전): 칩마다 제품 코드가 적혀 있어 코드로 색상표 항목을 찾는다.
  const V3_CHIPS = window.COLORBOOK_V3_CHIPS || {};
  const byCode = {};
  CHART.forEach(function (color) {
    byCode[color[1]] = color;
  });

  // 페이지 번호 → [{ box: [왼쪽, 위, 너비, 높이], color: 색상표 항목 }]
  // 색상표에 없는 코드(단종 색상)는 칩 링크를 만들지 않는다.
  const BOOKS = {
    v4: {
      dir: "images/colorbook",
      name: "대양피앤티 디지털 컬러북",
      count: 16,
      chips: function (num) {
        return (V4_CHIPS[num] || []).map(function (box, i) {
          return { box: box, color: CHART[v4Start[num] + i] };
        });
      }
    },
    v3: {
      dir: "images/colorbook-v3",
      name: "대양피앤티 컬러북 ver.3",
      count: 12,
      chips: function (num) {
        return (V3_CHIPS[num] || []).map(function (chip) {
          return { box: chip, color: byCode[chip[4]] };
        });
      }
    }
  };

  let BOOK = BOOKS.v4;
  let PAGES = [];

  function pagesFor(book) {
    const list = [];
    const count = book.count;
    for (let i = 1; i <= count; i++) {
      const n = ("0" + i).slice(-2);
      list.push({
        num: i,
        src: book.dir + "/page-" + n + ".jpg",
        alt: i === 1 ? book.name + " 표지" : i === count ? book.name + " 뒤표지" : book.name + " " + i + "페이지"
      });
    }
    return list;
  }

  const FLIP_MS = 800;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;
  const single = window.matchMedia("(max-width: 700px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.innerHTML =
    '<p class="cbook-disclaimer" data-i18n="colors.book.disclaimer">※ 본 색상은 웹 컬러로, 모니터에 따라 실제 도료 색과 다르게 보일 수 있습니다. 반드시 실제 칼라북으로 재확인하시기 바랍니다.</p>' +
    '<div class="cbook-stage" tabindex="0">' +
    '<div class="cbook-zoom">' +
    '<div class="cbook-book">' +
    '<div class="cbook-leaves"></div>' +
    '<div class="cbook-spine cbook-spine--front"></div>' +
    '<div class="cbook-spine cbook-spine--back"></div>' +
    "</div>" +
    "</div>" +
    "</div>" +
    '<div class="cbook-controls">' +
    '<button type="button" class="cbook-btn" data-dir="-1" data-i18n-aria-label="colors.book.prev" aria-label="이전 장">&#8249;</button>' +
    '<span class="cbook-indicator" aria-live="polite"></span>' +
    '<button type="button" class="cbook-btn" data-dir="1" data-i18n-aria-label="colors.book.next" aria-label="다음 장">&#8250;</button>' +
    '<span class="cbook-zoom-btns">' +
    '<button type="button" class="cbook-btn cbook-btn--zoom" data-zoom="-1" data-i18n-aria-label="colors.book.zoomOut" aria-label="축소">&minus;</button>' +
    '<button type="button" class="cbook-btn cbook-btn--zoom" data-zoom="0" data-i18n-aria-label="colors.book.zoomReset" aria-label="원래 크기">1:1</button>' +
    '<button type="button" class="cbook-btn cbook-btn--zoom" data-zoom="1" data-i18n-aria-label="colors.book.zoomIn" aria-label="확대">+</button>' +
    "</span>" +
    "</div>" +
    '<p class="cbook-hint" data-i18n="colors.book.hint">페이지를 클릭하면 넘어가고, 색상을 클릭하면 색상표로 이동합니다. 마우스 휠로 확대·축소, 확대 중에는 끌어서 이동할 수 있습니다.</p>';

  if (window.I18N) {
    window.I18N.apply(root);
  }

  const stage = root.querySelector(".cbook-stage");
  const zoomEl = root.querySelector(".cbook-zoom");
  const book = root.querySelector(".cbook-book");
  const leavesRoot = root.querySelector(".cbook-leaves");
  const indicator = root.querySelector(".cbook-indicator");
  const prevBtn = root.querySelector('[data-dir="-1"]');
  const nextBtn = root.querySelector('[data-dir="1"]');

  let leaves = [];
  let current = 0;
  let max = 0;
  let isSingle = single.matches;

  function escapeAttr(text) {
    return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // 칩 위에 투명한 링크를 깔아 누르면 색상표에서 그 색을 찾아 보여준다.
  function chipsHTML(page) {
    return BOOK.chips(page.num).map(function (chip) {
      const box = chip.box;
      const color = chip.color;
      if (!color) {
        return "";
      }
      const label = color[1] + " " + (window.I18N ? window.I18N.paintName(color[2]) : color[2]);
      return '<a class="cbook-chip" href="/colors?q=' + encodeURIComponent(color[1]) + '"' +
        ' style="left:' + box[0] + "%;top:" + box[1] + "%;width:" + box[2] + "%;height:" + box[3] + '%"' +
        ' title="' + escapeAttr(label) + '" aria-label="' + escapeAttr(label) + '" draggable="false"></a>';
    }).join("");
  }

  function pageHTML(page) {
    if (!page) {
      return '<div class="cbook-page"></div>';
    }
    return '<div class="cbook-page"><img src="' + page.src + '" alt="' + page.alt + '" loading="lazy" draggable="false">' + chipsHTML(page) + "</div>";
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

  // ---------- 확대·축소: 휠 위로 확대, 아래로 축소 (커서 위치 기준). 확대 중에는 끌어서 이동 ----------
  let scale = 1;
  let tx = 0;
  let ty = 0;

  function clampPan() {
    const w = stage.clientWidth;
    const h = zoomEl.offsetHeight;
    tx = Math.min(0, Math.max(w - w * scale, tx));
    ty = Math.min(0, Math.max(h - h * scale, ty));
  }

  function applyZoom() {
    if (scale <= ZOOM_MIN + 0.001) {
      scale = ZOOM_MIN;
      tx = 0;
      ty = 0;
    }
    clampPan();
    zoomEl.style.transform = scale === 1 ? "" : "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
    stage.classList.toggle("is-zoomed", scale > 1);
    root.querySelector('[data-zoom="-1"]').disabled = scale <= ZOOM_MIN;
    root.querySelector('[data-zoom="0"]').disabled = scale <= ZOOM_MIN;
    root.querySelector('[data-zoom="1"]').disabled = scale >= ZOOM_MAX;
  }

  function zoomAt(next, px, py) {
    next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    tx = px - (px - tx) * (next / scale);
    ty = py - (py - ty) * (next / scale);
    scale = next;
    applyZoom();
  }

  stage.addEventListener("wheel", function (e) {
    if (!e.deltaY) {
      return;
    }
    const zoomIn = e.deltaY < 0;
    // 원래 크기에서 휠을 내리면 페이지가 평소처럼 스크롤된다.
    if (!zoomIn && scale <= ZOOM_MIN) {
      return;
    }
    e.preventDefault();
    const rect = zoomEl.parentNode.getBoundingClientRect();
    const step = Math.min(1.25, Math.exp(Math.min(Math.abs(e.deltaY), 120) / 400));
    zoomAt(zoomIn ? scale * step : scale / step, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  root.querySelectorAll("[data-zoom]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const dir = Number(btn.getAttribute("data-zoom"));
      if (dir === 0) {
        scale = 1;
        applyZoom();
        return;
      }
      zoomAt(dir > 0 ? scale * 1.4 : scale / 1.4, stage.clientWidth / 2, zoomEl.offsetHeight / 2);
    });
  });

  // ---------- 넘기기(클릭·밀기)와 확대 중 끌기 ----------
  let down = null;
  let dragged = false;

  stage.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) {
      return;
    }
    down = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
    dragged = false;
  });
  stage.addEventListener("pointermove", function (e) {
    if (!down) {
      return;
    }
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (!dragged && Math.abs(dx) + Math.abs(dy) > 6) {
      dragged = true;
      if (scale > 1) {
        stage.setPointerCapture(e.pointerId);
        stage.classList.add("is-panning");
      }
    }
    if (dragged && scale > 1) {
      tx = down.tx + dx;
      ty = down.ty + dy;
      applyZoom();
    }
  });
  stage.addEventListener("pointerup", function (e) {
    if (!down) {
      return;
    }
    const dx = e.clientX - down.x;
    down = null;
    stage.classList.remove("is-panning");
    if (scale > 1 && dragged) {
      return;
    }
    // 색상 칩을 누르면 넘기지 않고 색상표로 이동한다 (링크가 처리).
    if (!dragged && e.target.closest(".cbook-chip")) {
      return;
    }
    if (!e.target.closest(".cbook-leaf")) {
      return;
    }
    if (Math.abs(dx) > 40) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (dragged) {
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
  stage.addEventListener("pointercancel", function () {
    down = null;
    stage.classList.remove("is-panning");
  });
  // 끌어서 움직인 뒤에는 칩 링크가 열리지 않게 한다.
  stage.addEventListener("click", function (e) {
    if (dragged && e.target.closest(".cbook-chip")) {
      e.preventDefault();
    }
  }, true);
  window.addEventListener("resize", applyZoom);

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

  // ---------- 컬러북 선택 (ver.4 / ver.3). 주소에 ?book=v3 를 남겨 바로 열 수 있게 한다 ----------
  const pickBtns = Array.prototype.slice.call(document.querySelectorAll(".cbook-pick[data-book]"));
  let bookId = "";

  function setBook(id) {
    if (!BOOKS[id] || id === bookId) {
      return;
    }
    bookId = id;
    BOOK = BOOKS[id];
    PAGES = pagesFor(BOOK);
    scale = 1;
    applyZoom();
    build(0);
    pickBtns.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-book") === id));
    });
    try {
      const url = new URL(window.location.href);
      if (id === "v4") {
        url.searchParams.delete("book");
      } else {
        url.searchParams.set("book", id);
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  pickBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setBook(btn.getAttribute("data-book"));
    });
  });

  let initial = "v4";
  try {
    initial = new URLSearchParams(window.location.search).get("book") === "v3" ? "v3" : "v4";
  } catch (e) {}
  setBook(initial);
})();
