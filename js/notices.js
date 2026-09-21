(function () {
  const list = document.getElementById("notice-list");
  if (!list) {
    return;
  }

  const notices = window.NOTICES || [];

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function render() {
    list.replaceChildren();

    if (!notices.length) {
      const empty = document.createElement("li");
      empty.className = "notice-empty";
      empty.textContent = t("notices.empty");
      list.appendChild(empty);
      return;
    }

    notices.forEach(function (item) {
      const li = document.createElement("li");
      const time = document.createElement("time");
      time.textContent = item.date;
      const span = document.createElement("span");
      span.textContent = item.title;
      li.appendChild(time);
      li.appendChild(span);
      list.appendChild(li);
    });
  }

  render();
  window.addEventListener("i18n:change", render);
})();
