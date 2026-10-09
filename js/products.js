(function () {
  const rows = document.querySelector(".product-rows");
  if (!rows || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  rows.classList.add("is-animated");
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  rows.querySelectorAll(".product-row").forEach(function (row) {
    observer.observe(row);
  });
})();
