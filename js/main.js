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
    const colGap = 24;
    const maxRight = window.innerWidth - margin;

    const centers = [];
    triggers.forEach(function (trigger, i) {
      const col = cols[i];
      if (!col) {
        return;
      }
      centers[i] = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2;
      col.style.left = centers[i] + "px";
    });

    const edges = [];
    cols.forEach(function (col, i) {
      if (centers[i] === undefined) {
        return;
      }
      const width = col.offsetWidth;
      edges[i] = { left: centers[i] - width / 2, right: centers[i] + width / 2, width: width };
    });

    for (let i = 1; i < edges.length; i++) {
      if (!edges[i] || !edges[i - 1]) {
        continue;
      }
      const minLeft = edges[i - 1].right + colGap;
      if (edges[i].left < minLeft) {
        const shift = minLeft - edges[i].left;
        edges[i].left += shift;
        edges[i].right += shift;
      }
    }

    for (let i = edges.length - 1; i >= 0; i--) {
      if (!edges[i]) {
        continue;
      }
      if (edges[i].right > maxRight) {
        const shift = edges[i].right - maxRight;
        edges[i].left -= shift;
        edges[i].right -= shift;
      }
      if (edges[i].left < margin) {
        const shift = margin - edges[i].left;
        edges[i].left += shift;
        edges[i].right += shift;
      }
      if (i > 0 && edges[i - 1] && edges[i - 1].right + colGap > edges[i].left) {
        const shift = edges[i - 1].right + colGap - edges[i].left;
        edges[i - 1].left -= shift;
        edges[i - 1].right -= shift;
      }
    }

    cols.forEach(function (col, i) {
      if (!edges[i]) {
        return;
      }
      col.style.left = (edges[i].left + edges[i].width / 2) + "px";
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
