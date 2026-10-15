(function () {
  var grid = document.querySelector(".app-grid");
  var panel = document.getElementById("app-detail");
  if (!grid || !panel) {
    return;
  }

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".app-card-btn"));
  var copy = panel.querySelector(".app-detail-inner");
  var imgs = panel.querySelectorAll(".app-detail-img");
  var targetList = panel.querySelector(".app-detail-targets");
  var keywordList = panel.querySelector(".app-detail-keywords");
  var closeBtn = panel.querySelector(".app-detail-close");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var active = null;
  var swapTimer = 0;

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  // data-i18n 키만 바꿔 두면 언어를 바꿀 때 i18n.js가 알아서 다시 번역한다.
  function setKey(el, key) {
    el.setAttribute("data-i18n", key);
    el.textContent = t(key);
  }

  function fillList(list, keys) {
    list.textContent = "";
    keys.forEach(function (key) {
      var li = document.createElement("li");
      setKey(li, key);
      list.appendChild(li);
    });
  }

  function fillCopy(card) {
    var ind = "applications." + card.getAttribute("data-ind");
    var count = Number(card.getAttribute("data-targets")) || 0;
    var targets = [];
    for (var i = 1; i <= count; i++) {
      targets.push(ind + ".t" + i);
    }
    setKey(panel.querySelector(".app-detail-en"), ind + ".eyebrow");
    setKey(panel.querySelector(".app-detail-title"), ind + ".name");
    setKey(panel.querySelector(".app-detail-intro"), ind + ".intro");
    setKey(panel.querySelector(".app-detail-focus"), ind + ".focus");
    fillList(targetList, targets);
    fillList(keywordList, [ind + ".k1", ind + ".k2", ind + ".k3"]);
  }

  // 두 장을 겹쳐 두고 뒤쪽 장에 새 사진을 올린 뒤 불투명도만 바꿔 크로스페이드한다.
  function swapImage(card, instant) {
    var current = panel.querySelector(".app-detail-img.is-current");
    var next = current === imgs[0] ? imgs[1] : imgs[0];
    var altKey = "applications." + card.getAttribute("data-ind") + ".panelAlt";
    var show = function () {
      next.onload = null;
      next.classList.add("is-current");
      current.classList.remove("is-current");
    };
    if (instant) {
      current.setAttribute("srcset", card.getAttribute("data-panel-srcset"));
      current.src = card.getAttribute("data-panel-src");
      current.setAttribute("data-i18n-alt", altKey);
      current.alt = t(altKey);
      return;
    }
    next.setAttribute("data-i18n-alt", altKey);
    next.alt = t(altKey);
    next.onload = show;
    next.setAttribute("srcset", card.getAttribute("data-panel-srcset"));
    next.src = card.getAttribute("data-panel-src");
    if (next.complete && next.naturalWidth) {
      show();
    }
  }

  function scrollToPanel() {
    var top = panel.getBoundingClientRect().top;
    var header = document.querySelector(".site-header");
    var offset = (header ? header.offsetHeight : 0) + 16;
    // 이미 화면 안에 패널 윗부분이 보이면 굳이 움직이지 않는다.
    if (top >= offset && top < window.innerHeight * 0.45) {
      return;
    }
    window.scrollTo({
      top: window.pageYOffset + top - offset,
      behavior: reduceMotion.matches ? "auto" : "smooth"
    });
  }

  function markActive(card) {
    cards.forEach(function (c) {
      var on = c === card;
      c.setAttribute("aria-expanded", String(on));
      c.parentNode.classList.toggle("is-active", on);
    });
    grid.classList.toggle("has-active", !!card);
  }

  function open(card) {
    if (card === active) {
      close();
      return;
    }
    var wasOpen = !!active;
    active = card;
    markActive(card);
    window.clearTimeout(swapTimer);

    if (!wasOpen) {
      fillCopy(card);
      swapImage(card, true);
      panel.hidden = false;
      // hidden을 푼 다음 프레임에 클래스를 붙여야 등장 전환이 보인다.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          panel.classList.add("is-open");
        });
      });
    } else if (reduceMotion.matches) {
      fillCopy(card);
      swapImage(card, true);
    } else {
      copy.classList.add("is-swapping");
      swapImage(card, false);
      swapTimer = window.setTimeout(function () {
        fillCopy(card);
        copy.classList.remove("is-swapping");
      }, 200);
    }
    scrollToPanel();
  }

  function close() {
    if (!active) {
      return;
    }
    var card = active;
    active = null;
    markActive(null);
    panel.classList.remove("is-open");
    panel.hidden = true;
    card.focus({ preventScroll: true });
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      open(card);
    });
  });

  closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && active) {
      close();
    }
  });

  // 데스크톱에서만 카드가 차례로 떠오른다. 모바일과 동작 줄이기 설정에서는 생략.
  var wide = window.matchMedia("(min-width: 901px)");
  if ("IntersectionObserver" in window && wide.matches && !reduceMotion.matches) {
    grid.classList.add("is-animated");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    grid.querySelectorAll(".app-card").forEach(function (item) {
      observer.observe(item);
    });
  }
})();
