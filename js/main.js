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

  function layoutNavLinks() {
    if (!header || !navLinks) {
      return;
    }
    if (window.innerWidth <= 800) {
      navLinks.style.left = "";
      return;
    }
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
    const width = navLinks.offsetWidth;
    const center = headerRect.width / 2;
    let left = center - width / 2;
    let right = center + width / 2;
    if (right > maxRight) {
      const shift = right - maxRight;
      left -= shift;
      right -= shift;
    }
    if (left < minLeft) {
      const shift = minLeft - left;
      left += shift;
      right += shift;
    }
    navLinks.style.left = (left + width / 2) + "px";
  }

  function layoutNav() {
    if (header) {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }

    triggers.forEach(function (trigger) {
      trigger.style.marginLeft = "";
    });
    if (navLinks) {
      navLinks.style.left = "";
    }

    if (window.innerWidth <= 800) {
      return;
    }

    const colGap = 24;

    const naturalCenters = [];
    triggers.forEach(function (trigger, i) {
      naturalCenters[i] = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2;
    });

    const colWidths = [];
    cols.forEach(function (col, i) {
      colWidths[i] = col.offsetWidth;
    });

    let cumulative = 0;
    for (let i = 1; i < triggers.length; i++) {
      if (colWidths[i] === undefined || colWidths[i - 1] === undefined) {
        continue;
      }
      const naturalGap = naturalCenters[i] - naturalCenters[i - 1];
      const required = (colWidths[i - 1] + colWidths[i]) / 2 + colGap;
      const extra = Math.max(0, required - naturalGap);
      cumulative += extra;
      if (cumulative) {
        triggers[i].style.marginLeft = cumulative + "px";
      }
    }

    layoutNavLinks();

    const margin = 20;
    const maxRight = window.innerWidth - margin;
    triggers.forEach(function (trigger, i) {
      const col = cols[i];
      if (!col) {
        return;
      }
      const center = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2;
      const width = colWidths[i] !== undefined ? colWidths[i] : col.offsetWidth;
      let colLeft = center;
      if (center + width / 2 > maxRight) {
        colLeft = center - (center + width / 2 - maxRight);
      } else if (center - width / 2 < margin) {
        colLeft = center + (margin - (center - width / 2));
      }
      col.style.left = colLeft + "px";
    });
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
