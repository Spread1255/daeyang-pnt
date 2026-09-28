(function () {
  var widget = document.querySelector("[data-careers-widget]");
  if (!widget) {
    return;
  }

  var link = widget.querySelector("[data-careers-link]");
  var badge = widget.querySelector("[data-careers-badge]");
  var note = widget.querySelector("[data-careers-note]");
  var isOpen = false;

  if (link) {
    link.addEventListener("click", function (event) {
      if (!isOpen) {
        event.preventDefault();
      }
    });
  }

  // 채용 열림 여부: 관리자 페이지의 설정(Supabase)을 우선, 불러오지 못하면 HTML의 data-open 값 사용
  function apply(open) {
    isOpen = open;
    widget.classList.toggle("is-open", open);
    if (link) {
      link.classList.toggle("is-disabled", !open);
      if (open) {
        link.removeAttribute("aria-disabled");
        link.removeAttribute("tabindex");
      } else {
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("tabindex", "-1");
      }
    }
    if (badge) {
      badge.hidden = open;
    }
    if (note) {
      note.hidden = open;
    }
  }

  apply(widget.getAttribute("data-open") === "true");

  if (window.DY_SB) {
    window.DY_SB
      .from("site_settings")
      .select("value")
      .eq("key", "careers_open")
      .maybeSingle()
      .then(function (res) {
        if (!res.error && res.data) {
          apply(res.data.value === true);
        }
      });
  }
})();
