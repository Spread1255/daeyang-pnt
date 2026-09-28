// 관리자 페이지 공통 도우미 (로그인 확인, DOM 생성)
(function () {
  var sb = window.DY_SB;

  async function checkAdmin() {
    if (!sb) {
      return false;
    }
    var session = await sb.auth.getSession();
    if (!session.data.session) {
      return false;
    }
    var res = await sb.rpc("is_admin");
    return !res.error && res.data === true;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) {
        return;
      }
      if (key === "class") {
        node.className = value;
      } else if (key === "text") {
        node.textContent = value;
      } else if (key.indexOf("on") === 0) {
        node.addEventListener(key.slice(2), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, value);
      }
    });
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function formatDateTime(iso) {
    var d = new Date(iso);
    function pad(n) {
      return String(n).padStart(2, "0");
    }
    return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  window.DY_ADMIN = {
    sb: sb,
    checkAdmin: checkAdmin,
    el: el,
    formatDateTime: formatDateTime
  };
})();
