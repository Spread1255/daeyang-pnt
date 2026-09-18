(function () {
  const stage = document.getElementById("homeStage");
  const windowEl = document.getElementById("homeWindow");
  const cue = document.querySelector(".home-stage-cue");
  if (!stage || !windowEl) {
    return;
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function progress() {
    const rect = stage.getBoundingClientRect();
    const travel = Math.max(1, stage.offsetHeight - window.innerHeight);
    const scrolled = Math.min(travel, Math.max(0, -rect.top));
    return scrolled / travel;
  }

  function apply(p) {
    const start = 0.06;
    const end = 0.78;
    const t = Math.min(1, Math.max(0, (p - start) / (end - start)));
    const ease = t * t * (3 - 2 * t);
    const scale = 0.52 + ease * 0.48;
    const opacity = ease;
    const y = (1 - ease) * 48;
    windowEl.style.transform = "translate3d(0, " + y + "px, 0) scale(" + scale + ")";
    windowEl.style.opacity = String(opacity);
    windowEl.style.pointerEvents = ease > 0.35 ? "auto" : "none";
    if (cue) {
      cue.style.opacity = String(Math.max(0, 1 - p * 3.2));
    }
  }

  function tick() {
    apply(progress());
  }

  if (reduce) {
    windowEl.style.transform = "none";
    windowEl.style.opacity = "1";
    windowEl.style.pointerEvents = "auto";
    if (cue) {
      cue.style.display = "none";
    }
    return;
  }

  apply(0);
  window.addEventListener("scroll", tick, { passive: true });
  window.addEventListener("resize", tick);
})();
