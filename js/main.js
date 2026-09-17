(function () {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const form = document.getElementById("inquiry-form");
  const status = document.getElementById("form-status");
  if (!form || !status) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const product = params.get("product");
  const productSel = form.querySelector('[name="product"]');
  const message = form.querySelector('[name="message"]');
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

  if (message && (params.get("kg") || params.get("preorder"))) {
    const lines = [
      t("contact.prefill.line1"),
      t("contact.prefill.product") + " " + (product || "-"),
      t("contact.prefill.pack") + " " + (params.get("pack") === "300" ? t("shop.pack.300") : t("shop.pack.20")),
      t("contact.prefill.qty") + " " + t("contact.prefill.qtyUnit")
        .replace("{qty}", params.get("qty") || "-")
        .replace("{kg}", params.get("kg") || "-")
    ];
    if (params.get("color")) {
      lines.push(t("contact.prefill.color") + " " + params.get("color"));
    }
    message.value = lines.join("\n");
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
