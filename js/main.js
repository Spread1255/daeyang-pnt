(function () {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const header = document.querySelector(".site-header");
  const navLinks = document.querySelector(".nav-links");
  const logo = document.querySelector(".logo");
  const langSwitch = document.querySelector(".lang-switch");
  const triggers = document.querySelectorAll(".nav-trigger");
  const cols = document.querySelectorAll(".nav-mega-col");

  const mega = document.querySelector(".nav-mega");

  function navBounds() {
    const margin = 24;
    const headerRect = header.getBoundingClientRect();
    let minLeft = margin;
    let maxRight = headerRect.width - margin;
    if (logo) {
      minLeft = Math.max(minLeft, logo.getBoundingClientRect().right - headerRect.left + margin);
    }
    if (langSwitch) {
      maxRight = Math.min(maxRight, langSwitch.getBoundingClientRect().left - headerRect.left - margin);
    }
    return { minLeft: minLeft, maxRight: maxRight, width: headerRect.width };
  }

  function layoutNavLinks() {
    if (!header || !navLinks) {
      return;
    }
    if (window.innerWidth <= 800) {
      navLinks.style.left = "";
      return;
    }
    const bounds = navBounds();
    const width = navLinks.offsetWidth;
    const center = bounds.width / 2;
    let left = center - width / 2;
    let right = center + width / 2;
    if (right > bounds.maxRight) {
      const shift = right - bounds.maxRight;
      left -= shift;
      right -= shift;
    }
    if (left < bounds.minLeft) {
      const shift = bounds.minLeft - left;
      left += shift;
      right += shift;
    }
    navLinks.style.left = (left + width / 2) + "px";
  }

  function maxWidth(els) {
    let max = 0;
    els.forEach(function (el) {
      max = Math.max(max, el.offsetWidth);
    });
    return max;
  }

  // 메뉴 글자 길이(언어)와 상관없이 상단 메뉴와 하위 메뉴 열을 같은 간격으로 맞춘다.
  function layoutNav() {
    triggers.forEach(function (trigger) {
      trigger.style.width = "";
    });
    cols.forEach(function (col) {
      col.style.left = "";
      col.style.width = "";
    });
    if (navLinks) {
      navLinks.style.left = "";
    }
    if (mega) {
      mega.style.height = "";
    }
    if (header) {
      header.classList.remove("nav-compact", "nav-tight");
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }

    if (window.innerWidth <= 800) {
      return;
    }

    const colGap = 24;
    const linkGap = parseFloat(getComputedStyle(navLinks).columnGap) || 0;
    function availableWidth() {
      const bounds = navBounds();
      return bounds.maxRight - bounds.minLeft;
    }

    let available = availableWidth();
    let step = Math.max(maxWidth(triggers) + linkGap, maxWidth(cols) + colGap);
    if (step * triggers.length > available) {
      header.classList.add("nav-compact");
      if ((maxWidth(triggers) + linkGap) * triggers.length > available) {
        header.classList.add("nav-tight");
        available = availableWidth();
      }
      step = Math.max(maxWidth(triggers) + linkGap, available / triggers.length);
      cols.forEach(function (col) {
        col.style.width = (step - colGap) + "px";
      });
    }

    triggers.forEach(function (trigger) {
      trigger.style.width = (step - linkGap) + "px";
    });

    layoutNavLinks();

    const margin = 20;
    const maxRight = window.innerWidth - margin;
    let colBottom = 0;
    triggers.forEach(function (trigger, i) {
      const col = cols[i];
      if (!col) {
        return;
      }
      const center = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2;
      const width = col.offsetWidth;
      let colLeft = center;
      if (center + width / 2 > maxRight) {
        colLeft = center - (center + width / 2 - maxRight);
      } else if (center - width / 2 < margin) {
        colLeft = center + (margin - (center - width / 2));
      }
      col.style.left = colLeft + "px";
      colBottom = Math.max(colBottom, col.offsetTop + col.offsetHeight);
    });

    if (mega && colBottom + 14 > mega.offsetHeight) {
      mega.style.height = (colBottom + 14) + "px";
    }
  }

  if (header && triggers.length && cols.length) {
    layoutNav();
    window.addEventListener("resize", layoutNav);
    window.addEventListener("load", layoutNav);
    window.addEventListener("i18n:change", layoutNav);
  }

  const form = document.getElementById("inquiry-form");
  const status = document.getElementById("form-status");
  if (!form || !status) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const product = params.get("product");
  const productSel = form.querySelector('[name="product"]');
  if (product && productSel) {
    const match = Array.prototype.find.call(productSel.options, function (opt) {
      return opt.value.indexOf(product.split(" ")[0]) !== -1;
    });
    if (match) {
      productSel.value = match.value;
    }
  }
  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const saved = JSON.parse(localStorage.getItem("daeyang.pnt.inquiries") || "[]");
    saved.push({ ...data, at: new Date().toISOString() });
    localStorage.setItem("daeyang.pnt.inquiries", JSON.stringify(saved));
    form.reset();
    status.textContent = t("contact.status.submitted");
  });
})();
