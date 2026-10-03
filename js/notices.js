(function () {
  const list = document.getElementById("notice-list");
  if (!list) {
    return;
  }

  // 관리자 페이지에서 등록한 공지(Supabase) + notices-data.js의 기존 공지
  let dbNotices = [];
  const fileNotices = window.NOTICES || [];

  function t(key) {
    return window.I18N ? window.I18N.t(key) : key;
  }

  function formatDate(iso) {
    return String(iso || "").replace(/-/g, ".");
  }

  function render() {
    list.replaceChildren();
    const notices = dbNotices.concat(fileNotices);

    if (!notices.length) {
      const empty = document.createElement("li");
      empty.className = "notice-empty";
      empty.textContent = t("notices.empty");
      list.appendChild(empty);
      return;
    }

    notices.forEach(function (item) {
      const li = document.createElement("li");
      if (item.id) {
        li.id = "notice-" + item.id;
      }
      const time = document.createElement("time");
      time.textContent = item.date;
      const span = document.createElement("span");
      span.textContent = item.title;

      if (item.body) {
        li.className = "notice-has-body";
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.appendChild(time);
        summary.appendChild(span);
        const body = document.createElement("div");
        body.className = "notice-body";
        body.textContent = item.body;
        details.appendChild(summary);
        details.appendChild(body);
        li.appendChild(details);
      } else {
        li.appendChild(time);
        li.appendChild(span);
      }
      list.appendChild(li);
    });
    openFromHash();
  }

  // 챗봇 등에서 notices.html#notice-12 로 들어오면 그 공지를 펼치고 보여준다.
  function openFromHash() {
    const m = window.location.hash.match(/^#notice-(\d+)$/);
    const li = m && document.getElementById("notice-" + m[1]);
    if (!li) {
      return;
    }
    const details = li.querySelector("details");
    if (details) {
      details.open = true;
    }
    li.classList.add("is-target");
    li.scrollIntoView({ block: "center" });
  }

  render();
  window.addEventListener("i18n:change", render);
  window.addEventListener("hashchange", openFromHash);

  if (window.DY_SB) {
    window.DY_SB
      .from("notices")
      .select("id, title, body, notice_date")
      .order("notice_date", { ascending: false })
      .order("id", { ascending: false })
      .then(function (res) {
        if (res.error || !res.data) {
          return;
        }
        dbNotices = res.data.map(function (row) {
          return { id: row.id, date: formatDate(row.notice_date), title: row.title, body: row.body };
        });
        render();
      });
  }
})();
