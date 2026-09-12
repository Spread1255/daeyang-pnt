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
  if (message && (params.get("kg") || params.get("preorder"))) {
    const lines = [
      "구매 선접수입니다. 금액은 접수 후 통보해 주세요.",
      "제품: " + (product || "-"),
      "포장: " + (params.get("pack") === "300" ? "산업 300kg" : "소량 20kg"),
      "수량: " + (params.get("qty") || "-") + "포 / " + (params.get("kg") || "-") + "kg"
    ];
    if (params.get("color")) {
      lines.push("색상: " + params.get("color"));
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
    status.textContent = "선접수되었습니다. 금액은 접수 확인 후 안내합니다.";
  });
})();
