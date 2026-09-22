(function () {
  var widget = document.querySelector("[data-careers-widget]");
  if (!widget) {
    return;
  }

  var link = widget.querySelector("[data-careers-link]");
  var badge = widget.querySelector("[data-careers-badge]");
  var note = widget.querySelector("[data-careers-note]");
  var isOpen = widget.getAttribute("data-open") === "true";

  function blockClick(event) {
    event.preventDefault();
  }

  if (isOpen) {
    widget.classList.add("is-open");
    if (link) {
      link.classList.remove("is-disabled");
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
    }
    if (badge) {
      badge.remove();
    }
    if (note) {
      note.remove();
    }
  } else if (link) {
    link.addEventListener("click", blockClick);
  }
})();
