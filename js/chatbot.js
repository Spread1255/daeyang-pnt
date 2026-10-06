(function () {
  // 메인 화면 AI 상담 챗봇: 화면 오른쪽 가운데에 고정된 버튼 → 대화창.
  // 답변은 Supabase 함수(chatbot)가 Claude로 만든다.
  // 첫 화면에는 관리자 페이지에서 "챗봇에 표시"로 고른 공지가 나온다.
  var SUPABASE_URL = "https://sdcffvigzrczixbdvkzu.supabase.co";
  var SUPABASE_KEY = "sb_publishable_VRNSegvHcAk8Rh9RSoHzDQ_2WRBaEiN";
  var ENDPOINT = SUPABASE_URL + "/functions/v1/chatbot";
  var STORE_KEY = "daeyang.chat";

  var TEXT = {
    ko: {
      open: "AI 상담",
      title: "대양피엔티 AI 상담",
      close: "닫기",
      notices: "공지사항",
      placeholder: "궁금한 점을 입력하세요",
      send: "보내기",
      thinking: "답변을 준비하고 있습니다…",
      note: "AI 답변은 부정확할 수 있습니다. 가격·납기 등은 담당자(031-987-8587)에게 확인해 주세요.",
      reset: "새 대화",
      chips: ["제품 종류 알려줘", "외장용 도료 추천", "MSDS는 어디서 받아요?", "견적 문의 방법"],
      error: "지금은 답변할 수 없습니다. 잠시 후 다시 시도하시거나 031-987-8587로 연락해 주세요.",
      limited: "질문이 너무 많아 잠시 쉬어갑니다. 조금 뒤에 다시 물어봐 주세요.",
      refused: "이 질문에는 답변드리기 어렵습니다. 대양피엔티 제품·서비스에 대해 물어봐 주세요."
    },
    en: {
      open: "AI Chat",
      title: "DAEYANG P&T AI Assistant",
      close: "Close",
      notices: "Notices",
      placeholder: "Type your question",
      send: "Send",
      thinking: "Preparing an answer…",
      note: "AI answers may be inaccurate. Please confirm prices and lead times with our team (+82-31-987-8587).",
      reset: "New chat",
      chips: ["What products do you make?", "Recommend an exterior coating", "Where can I get MSDS?", "How do I request a quote?"],
      error: "I can't answer right now. Please try again later or call +82-31-987-8587.",
      limited: "Too many questions for now. Please try again in a little while.",
      refused: "I can't help with that. Please ask about DAEYANG P&T products and services."
    },
    ja: {
      open: "AI相談",
      title: "大洋P&T AI相談",
      close: "閉じる",
      notices: "お知らせ",
      placeholder: "ご質問を入力してください",
      send: "送信",
      thinking: "回答を準備しています…",
      note: "AIの回答は不正確な場合があります。価格・納期は担当者（+82-31-987-8587）にご確認ください。",
      reset: "新しい会話",
      chips: ["製品の種類は？", "屋外用塗料のおすすめ", "MSDSはどこで入手できますか？", "見積りの依頼方法"],
      error: "現在お答えできません。しばらくしてから再度お試しいただくか、+82-31-987-8587までご連絡ください。",
      limited: "質問が多すぎるため少しお休みします。しばらくしてから再度お尋ねください。",
      refused: "このご質問にはお答えできません。大洋P&Tの製品・サービスについてお尋ねください。"
    },
    zh: {
      open: "AI咨询",
      title: "大洋P&T AI咨询",
      close: "关闭",
      notices: "公告",
      placeholder: "请输入您的问题",
      send: "发送",
      thinking: "正在准备回答…",
      note: "AI回答可能不准确。价格、交期等请向负责人（+82-31-987-8587）确认。",
      reset: "新对话",
      chips: ["有哪些产品？", "推荐户外用涂料", "在哪里下载MSDS？", "如何询价？"],
      error: "目前无法回答。请稍后重试，或致电 +82-31-987-8587。",
      limited: "提问过多，请稍后再试。",
      refused: "无法回答该问题。请咨询大洋P&T的产品与服务。"
    }
  };

  function lang() {
    var l = (document.documentElement.lang || "ko").slice(0, 2);
    return TEXT[l] ? l : "ko";
  }

  function tx(key) {
    return TEXT[lang()][key];
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  }

  // 답변 글자 속 주소만 링크로 바꾼다 (HTML은 그대로 글자로 표시)
  function fillText(node, text) {
    var re = /(https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?。、）])/g;
    var last = 0;
    var m;
    while ((m = re.exec(text))) {
      node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el("a", "", m[1]);
      a.href = m[1];
      if (m[1].indexOf("daeyangpnt.co.kr") === -1) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      node.appendChild(a);
      last = m.index + m[1].length;
    }
    node.appendChild(document.createTextNode(text.slice(last)));
  }

  // 챗봇에 표시할 공지 (관리자에서 체크한 것)
  var notices = [];
  fetch(SUPABASE_URL + "/rest/v1/notices?select=id,title,notice_date&show_in_chat=eq.true&order=notice_date.desc,id.desc&limit=10", {
    headers: { apikey: SUPABASE_KEY }
  }).then(function (res) {
    return res.ok ? res.json() : [];
  }).then(function (rows) {
    notices = Array.isArray(rows) ? rows : [];
    if (notices.length) {
      paint();
    }
  }).catch(function () {
    // 공지를 못 불러와도 챗봇은 그대로 쓴다
  });

  function noticeBox() {
    var box = el("section", "chatbot-notices");
    var h = el("h3");
    h.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>';
    h.appendChild(document.createTextNode(tx("notices")));
    var ul = el("ul");
    notices.forEach(function (n) {
      var a = el("a");
      a.href = "/notice#notice-" + n.id;
      a.appendChild(el("span", "", n.title));
      a.appendChild(el("time", "", String(n.notice_date || "").replace(/-/g, ".")));
      var li = el("li");
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(h);
    box.appendChild(ul);
    return box;
  }

  var history = [];
  try {
    history = JSON.parse(sessionStorage.getItem(STORE_KEY)) || [];
  } catch (e) {
    history = [];
  }
  function save() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30)));
    } catch (e) {
      // 저장 못 해도 대화는 계속된다
    }
  }

  var root = el("div", "chatbot");
  var toggle = el("button", "chatbot-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "chatbot-panel");
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6a.5.5 0 0 1-.8-.4V16h-.5A.5.5 0 0 1 4 15.5z" fill="currentColor"/><circle cx="8.5" cy="9.5" r="1.2" fill="#e07a28"/><circle cx="12" cy="9.5" r="1.2" fill="#e07a28"/><circle cx="15.5" cy="9.5" r="1.2" fill="#e07a28"/></svg><span class="chatbot-toggle-label"></span>';

  var panel = el("section", "chatbot-panel");
  panel.id = "chatbot-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");

  var head = el("header", "chatbot-head");
  var title = el("h2", "chatbot-title");
  var resetBtn = el("button", "chatbot-reset");
  resetBtn.type = "button";
  var closeBtn = el("button", "chatbot-close");
  closeBtn.type = "button";
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  head.appendChild(title);
  head.appendChild(resetBtn);
  head.appendChild(closeBtn);

  var log = el("div", "chatbot-log");
  log.setAttribute("aria-live", "polite");
  var chips = el("div", "chatbot-chips");

  var form = el("form", "chatbot-form");
  var input = el("textarea", "chatbot-input");
  input.rows = 1;
  input.maxLength = 1000;
  var sendBtn = el("button", "chatbot-send");
  sendBtn.type = "submit";
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/></svg>';
  form.appendChild(input);
  form.appendChild(sendBtn);
  var note = el("p", "chatbot-note");

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  panel.appendChild(note);
  root.appendChild(panel);
  root.appendChild(toggle);
  document.body.appendChild(root);

  function bubble(role, text) {
    var b = el("div", "chatbot-msg chatbot-msg--" + role);
    fillText(b, text);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function paint() {
    title.textContent = tx("title");
    toggle.querySelector(".chatbot-toggle-label").textContent = tx("open");
    toggle.setAttribute("aria-label", tx("title"));
    panel.setAttribute("aria-label", tx("title"));
    closeBtn.setAttribute("aria-label", tx("close"));
    resetBtn.textContent = tx("reset");
    input.placeholder = tx("placeholder");
    sendBtn.setAttribute("aria-label", tx("send"));
    note.textContent = tx("note");
    log.replaceChildren();
    if (notices.length) {
      log.appendChild(noticeBox());
    }
    history.forEach(function (turn) {
      bubble(turn.role === "user" ? "user" : "bot", turn.content);
    });
    chips.replaceChildren();
    chips.hidden = history.length > 0;
    tx("chips").forEach(function (q) {
      var c = el("button", "chatbot-chip", q);
      c.type = "button";
      c.addEventListener("click", function () {
        ask(q);
      });
      chips.appendChild(c);
    });
  }

  var busy = false;
  function ask(question) {
    question = question.trim();
    if (!question || busy) {
      return;
    }
    busy = true;
    sendBtn.disabled = true;
    chips.hidden = true;
    history.push({ role: "user", content: question });
    save();
    bubble("user", question);
    var wait = bubble("bot", tx("thinking"));
    wait.classList.add("is-waiting");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12) })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (r) {
      wait.remove();
      if (r.data && r.data.reply) {
        history.push({ role: "assistant", content: r.data.reply });
        save();
        bubble("bot", r.data.reply);
        return;
      }
      var key = r.status === 429 ? "limited" : r.data && r.data.error === "refused" ? "refused" : "error";
      history.pop();
      save();
      bubble("bot", tx(key)).classList.add("is-error");
    }).catch(function () {
      wait.remove();
      history.pop();
      save();
      bubble("bot", tx("error")).classList.add("is-error");
    }).then(function () {
      busy = false;
      sendBtn.disabled = false;
    });
  }

  function setOpen(open) {
    panel.hidden = !open;
    root.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      log.scrollTop = log.scrollHeight;
      input.focus();
    }
  }

  toggle.addEventListener("click", function () {
    setOpen(panel.hidden);
  });
  closeBtn.addEventListener("click", function () {
    setOpen(false);
    toggle.focus();
  });
  resetBtn.addEventListener("click", function () {
    history = [];
    save();
    paint();
    input.focus();
  });
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      setOpen(false);
      toggle.focus();
    }
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value;
    input.value = "";
    input.style.height = "";
    ask(q);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener("input", function () {
    input.style.height = "";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  window.addEventListener("i18n:change", paint);
  paint();
})();
