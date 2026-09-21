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
  const triggers = document.querySelectorAll(".nav-trigger");
  const cols = document.querySelectorAll(".nav-mega-col");

  function layoutNavMega() {
    if (header) {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }
    if (window.innerWidth <= 800) {
      return;
    }
    const margin = 20;
    const maxRight = window.innerWidth - margin;
    triggers.forEach(function (trigger, i) {
      const col = cols[i];
      if (!col) {
        return;
      }
      const center = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2;
      col.style.left = center + "px";
      const colRect = col.getBoundingClientRect();
      let shift = 0;
      if (colRect.right > maxRight) {
        shift = colRect.right - maxRight;
      } else if (colRect.left < margin) {
        shift = colRect.left - margin;
      }
      if (shift) {
        col.style.left = (center - shift) + "px";
      }
    });
  }

  if (header && triggers.length && cols.length) {
    layoutNavMega();
    window.addEventListener("resize", layoutNavMega);
    window.addEventListener("load", layoutNavMega);
    window.addEventListener("i18n:change", layoutNavMega);
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
