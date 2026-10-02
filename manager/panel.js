// 관리자 패널: 공지사항 / 제휴문의 / 채용 / 자료실
(function () {
  var A = window.DY_ADMIN;
  var sb = A && A.sb;
  var el = A && A.el;
  var main = document.getElementById("panel-main");

  var STATUS_LABEL = { new: "새 문의", read: "확인함", done: "처리 완료" };
  var CATEGORY_LABEL = { cert: "인증서/확인서", msds: "MSDS" };
  var INQUIRY_FIELDS = [
    ["company", "회사명"],
    ["name", "담당자"],
    ["email", "이메일"],
    ["product", "제휴 분야"],
    ["message", "문의 내용"],
    ["lang", "사이트 언어"]
  ];

  if (!sb) {
    main.replaceChildren(el("p", { class: "a-empty", text: "서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요." }));
    return;
  }

  function msgNode() {
    return el("p", { class: "a-msg", role: "status" });
  }

  function setMsg(node, text, kind) {
    node.textContent = text;
    node.className = "a-msg" + (kind ? " is-" + kind : "");
  }

  function header(title, lede) {
    return [el("h1", { text: title }), el("p", { class: "panel-lede", text: lede })];
  }

  function today() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // ---------------- 공지사항 ----------------
  async function renderNotices() {
    var editingId = null;
    var msg = msgNode();
    var titleInput = el("input", { name: "title", type: "text", maxlength: "200", required: true });
    var dateInput = el("input", { name: "notice_date", type: "date", required: true, value: today() });
    var bodyInput = el("textarea", { name: "body", rows: "8", maxlength: "20000" });
    var formTitle = el("h2", { text: "새 공지 작성" });
    var submitBtn = el("button", { class: "a-btn", type: "submit", text: "등록" });
    var cancelBtn = el("button", { class: "a-btn a-btn--ghost", type: "button", text: "취소", hidden: true, onclick: resetForm });
    var list = el("ul", { class: "a-list" });

    var form = el("form", { class: "a-card", onsubmit: onSubmit }, [
      formTitle,
      el("label", { class: "a-field" }, ["제목", titleInput]),
      el("label", { class: "a-field" }, ["게시일", dateInput]),
      el("label", { class: "a-field" }, ["내용", el("small", { text: "선택 사항 · 입력하면 공지 제목을 눌렀을 때 펼쳐집니다." }), bodyInput]),
      el("div", { class: "a-row" }, [submitBtn, cancelBtn]),
      msg
    ]);

    main.replaceChildren.apply(main, header("공지사항", "등록한 공지는 홈페이지 공지사항 페이지에 바로 표시됩니다.").concat([
      el("div", { class: "panel-grid" }, [form, el("section", { class: "a-card" }, [el("h2", { text: "등록된 공지" }), list])])
    ]));

    function resetForm() {
      editingId = null;
      form.reset();
      dateInput.value = today();
      formTitle.textContent = "새 공지 작성";
      submitBtn.textContent = "등록";
      cancelBtn.hidden = true;
    }

    async function load() {
      var res = await sb.from("notices").select("*").order("notice_date", { ascending: false }).order("id", { ascending: false });
      list.replaceChildren();
      if (res.error) {
        list.appendChild(el("li", { class: "a-empty", text: "목록을 불러오지 못했습니다." }));
        return;
      }
      if (!res.data.length) {
        list.appendChild(el("li", { class: "a-empty", text: "등록된 공지가 없습니다." }));
        return;
      }
      res.data.forEach(function (row) {
        list.appendChild(el("li", {}, [
          el("div", { class: "a-list-main" }, [
            el("span", { class: "a-list-title", text: row.title }),
            el("span", { class: "a-list-meta", text: row.notice_date.replace(/-/g, ".") + (row.body ? " · 내용 있음" : "") })
          ]),
          el("div", { class: "a-row" }, [
            el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "수정", onclick: function () { startEdit(row); } }),
            el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: function () { remove(row); } })
          ])
        ]));
      });
    }

    function startEdit(row) {
      editingId = row.id;
      titleInput.value = row.title;
      dateInput.value = row.notice_date;
      bodyInput.value = row.body || "";
      formTitle.textContent = "공지 수정";
      submitBtn.textContent = "수정 저장";
      cancelBtn.hidden = false;
      setMsg(msg, "");
      titleInput.focus();
    }

    async function remove(row) {
      if (!confirm("'" + row.title + "' 공지를 삭제할까요?")) {
        return;
      }
      var res = await sb.from("notices").delete().eq("id", row.id);
      if (res.error) {
        setMsg(msg, "삭제하지 못했습니다: " + res.error.message, "error");
        return;
      }
      if (editingId === row.id) {
        resetForm();
      }
      setMsg(msg, "삭제했습니다.", "ok");
      load();
    }

    async function onSubmit(event) {
      event.preventDefault();
      var payload = {
        title: titleInput.value.trim(),
        notice_date: dateInput.value,
        body: bodyInput.value.trim() || null
      };
      if (!payload.title || !payload.notice_date) {
        setMsg(msg, "제목과 게시일을 입력해 주세요.", "error");
        return;
      }
      submitBtn.disabled = true;
      var res = editingId
        ? await sb.from("notices").update(Object.assign(payload, { updated_at: new Date().toISOString() })).eq("id", editingId)
        : await sb.from("notices").insert(payload);
      submitBtn.disabled = false;
      if (res.error) {
        setMsg(msg, "저장하지 못했습니다: " + res.error.message, "error");
        return;
      }
      setMsg(msg, editingId ? "수정했습니다." : "등록했습니다.", "ok");
      resetForm();
      load();
    }

    load();
  }

  // ---------------- 제휴문의 ----------------
  async function renderInquiries() {
    var filter = "all";
    var wrap = el("div");
    var select = el("select", { onchange: function () { filter = select.value; load(); } }, [
      el("option", { value: "all", text: "전체" }),
      el("option", { value: "new", text: "새 문의" }),
      el("option", { value: "read", text: "확인함" }),
      el("option", { value: "done", text: "처리 완료" })
    ]);

    main.replaceChildren.apply(main, header("제휴문의", "홈페이지 제휴문의 폼으로 들어온 문의입니다. 펼쳐서 내용을 확인하고 처리 상태를 바꿀 수 있습니다.").concat([
      el("label", { class: "a-field inq-filter" }, ["상태", select]),
      wrap
    ]));

    async function load() {
      var query = sb.from("inquiries").select("*").order("created_at", { ascending: false }).limit(500);
      if (filter !== "all") {
        query = query.eq("status", filter);
      }
      var res = await query;
      wrap.replaceChildren();
      if (res.error) {
        wrap.appendChild(el("p", { class: "a-empty", text: "목록을 불러오지 못했습니다." }));
        return;
      }
      if (!res.data.length) {
        wrap.appendChild(el("p", { class: "a-empty", text: "문의가 없습니다." }));
        return;
      }
      res.data.forEach(function (row) {
        wrap.appendChild(item(row));
      });
    }

    function item(row) {
      var data = row.data || {};
      var tag = el("span", { class: "status-tag status-tag--" + row.status, text: STATUS_LABEL[row.status] });
      var msg = msgNode();
      var memo = el("textarea", { rows: "3", maxlength: "5000" });
      memo.value = row.admin_memo || "";
      var statusSel = el("select", {}, Object.keys(STATUS_LABEL).map(function (key) {
        return el("option", { value: key, text: STATUS_LABEL[key], selected: key === row.status });
      }));

      var fields = el("dl", { class: "inq-fields" });
      INQUIRY_FIELDS.forEach(function (pair) {
        if (data[pair[0]]) {
          fields.appendChild(el("dt", { text: pair[1] }));
          fields.appendChild(el("dd", {}, [
            pair[0] === "email" ? el("a", { href: "mailto:" + data.email, text: data.email }) : String(data[pair[0]])
          ]));
        }
      });

      var details = el("details", { class: "inq-item" }, [
        el("summary", {}, [
          tag,
          el("div", { class: "a-list-main" }, [
            el("span", { class: "a-list-title", text: (data.company || "(회사명 없음)") + " · " + (data.name || "") }),
            el("span", { class: "a-list-meta", text: A.formatDateTime(row.created_at) + (data.product ? " · " + data.product : "") })
          ])
        ]),
        el("div", { class: "inq-body" }, [
          fields,
          el("label", { class: "a-field" }, ["처리 상태", statusSel]),
          el("label", { class: "a-field" }, ["관리자 메모", el("small", { text: "홈페이지에는 보이지 않습니다." }), memo]),
          el("div", { class: "a-row" }, [
            el("button", { class: "a-btn a-btn--sm", type: "button", text: "저장", onclick: save }),
            el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: remove })
          ]),
          msg
        ])
      ]);

      // 새 문의를 처음 펼치면 자동으로 '확인함' 처리
      details.addEventListener("toggle", async function () {
        if (details.open && row.status === "new") {
          var res = await sb.from("inquiries").update({ status: "read" }).eq("id", row.id);
          if (!res.error) {
            row.status = "read";
            statusSel.value = "read";
            tag.className = "status-tag status-tag--read";
            tag.textContent = STATUS_LABEL.read;
            refreshNewCount();
          }
        }
      });

      async function save() {
        var res = await sb.from("inquiries").update({ status: statusSel.value, admin_memo: memo.value.trim() || null }).eq("id", row.id);
        if (res.error) {
          setMsg(msg, "저장하지 못했습니다: " + res.error.message, "error");
          return;
        }
        row.status = statusSel.value;
        tag.className = "status-tag status-tag--" + row.status;
        tag.textContent = STATUS_LABEL[row.status];
        setMsg(msg, "저장했습니다.", "ok");
        refreshNewCount();
      }

      async function remove() {
        if (!confirm("이 문의를 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) {
          return;
        }
        var res = await sb.from("inquiries").delete().eq("id", row.id);
        if (res.error) {
          setMsg(msg, "삭제하지 못했습니다: " + res.error.message, "error");
          return;
        }
        details.remove();
        refreshNewCount();
      }

      return details;
    }

    load();
  }

  // ---------------- 채용 ----------------
  async function renderCareers() {
    var msg = msgNode();
    var input = el("input", { type: "checkbox", role: "switch", "aria-label": "채용 공고 열기" });
    var stateText = el("strong");

    main.replaceChildren.apply(main, header("채용", "채용 페이지의 '채용 사이트 바로가기' 버튼을 열거나 닫습니다.").concat([
      el("section", { class: "a-card" }, [
        el("div", { class: "switch-row" }, [
          el("div", {}, [
            el("div", {}, ["현재 상태: ", stateText]),
            el("span", { class: "a-list-meta", text: "켜면 버튼이 활성화되고 '현재 채용 마감' 표시가 사라집니다." })
          ]),
          el("label", { class: "switch" }, [input, el("span")])
        ]),
        msg
      ])
    ]));

    function paint(open) {
      input.checked = open;
      stateText.textContent = open ? "채용 중" : "채용 마감";
    }

    var res = await sb.from("site_settings").select("value").eq("key", "careers_open").maybeSingle();
    if (res.error) {
      setMsg(msg, "설정을 불러오지 못했습니다.", "error");
      input.disabled = true;
      return;
    }
    paint(!!(res.data && res.data.value === true));

    input.addEventListener("change", async function () {
      var open = input.checked;
      input.disabled = true;
      var up = await sb.from("site_settings").upsert({ key: "careers_open", value: open, updated_at: new Date().toISOString() });
      input.disabled = false;
      if (up.error) {
        paint(!open);
        setMsg(msg, "저장하지 못했습니다: " + up.error.message, "error");
        return;
      }
      paint(open);
      setMsg(msg, open ? "채용 버튼을 열었습니다." : "채용 버튼을 닫았습니다.", "ok");
    });
  }

  // ---------------- 자료실 ----------------
  async function renderResources() {
    var msg = msgNode();
    var category = el("select", { name: "category" }, [
      el("option", { value: "cert", text: "인증서/확인서 (인증서 페이지)" })
    ]);
    var title = el("input", { name: "title", type: "text", maxlength: "200", required: true });
    var desc = el("input", { name: "description", type: "text", maxlength: "500", placeholder: "예: 품질경영시스템 · 2026.09.18" });
    var file = el("input", { name: "file", type: "file", required: true, accept: "application/pdf,image/jpeg,image/png,image/webp" });
    var submitBtn = el("button", { class: "a-btn", type: "submit", text: "업로드" });
    var list = el("ul", { class: "a-list" });

    var form = el("form", { class: "a-card", onsubmit: onSubmit }, [
      el("h2", { text: "파일 올리기" }),
      el("label", { class: "a-field" }, ["게시 위치", category]),
      el("label", { class: "a-field" }, ["제목", title]),
      el("label", { class: "a-field" }, ["설명", el("small", { text: "선택 사항 · 발급기관, 날짜 등" }), desc]),
      el("label", { class: "a-field" }, ["파일", el("small", { text: "PDF, JPG, PNG, WEBP · 최대 20MB" }), file]),
      submitBtn,
      msg
    ]);

    main.replaceChildren.apply(main, header("자료실", "올린 파일은 인증서/확인서 페이지에 표시됩니다. MSDS는 [MSDS] 탭에서 올려 주세요. 기존에 홈페이지에 들어 있던 인증서 4개는 여기 목록에 나오지 않습니다.").concat([
      el("div", { class: "panel-grid" }, [form, el("section", { class: "a-card" }, [el("h2", { text: "올린 자료" }), list])])
    ]));

    async function load() {
      var res = await sb.from("resources").select("*").eq("category", "cert").order("sort_order").order("created_at", { ascending: false });
      list.replaceChildren();
      if (res.error) {
        list.appendChild(el("li", { class: "a-empty", text: "목록을 불러오지 못했습니다." }));
        return;
      }
      if (!res.data.length) {
        list.appendChild(el("li", { class: "a-empty", text: "올린 자료가 없습니다." }));
        return;
      }
      res.data.forEach(function (row) {
        list.appendChild(el("li", {}, [
          el("div", { class: "a-list-main" }, [
            el("span", { class: "a-list-title", text: row.title }),
            el("span", { class: "a-list-meta", text: CATEGORY_LABEL[row.category] + (row.description ? " · " + row.description : "") })
          ]),
          el("div", { class: "a-row" }, [
            el("a", { class: "a-btn a-btn--ghost a-btn--sm", href: window.DY_RESOURCE_URL(row.file_path, row.title + "." + (row.file_path.split(".").pop() || "pdf")), text: "다운로드" }),
            el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: function () { remove(row); } })
          ])
        ]));
      });
    }

    async function remove(row) {
      if (!confirm("'" + row.title + "' 자료를 삭제할까요? 홈페이지에서도 사라집니다.")) {
        return;
      }
      var st = await sb.storage.from("resources").remove([row.file_path]);
      if (st.error) {
        setMsg(msg, "파일을 삭제하지 못했습니다: " + st.error.message, "error");
        return;
      }
      var res = await sb.from("resources").delete().eq("id", row.id);
      if (res.error) {
        setMsg(msg, "삭제하지 못했습니다: " + res.error.message, "error");
        return;
      }
      setMsg(msg, "삭제했습니다.", "ok");
      load();
    }

    async function onSubmit(event) {
      event.preventDefault();
      var f = file.files[0];
      if (!title.value.trim() || !f) {
        setMsg(msg, "제목과 파일을 입력해 주세요.", "error");
        return;
      }
      if (f.size > 20 * 1024 * 1024) {
        setMsg(msg, "파일이 20MB를 넘습니다.", "error");
        return;
      }
      var ext = (f.name.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase();
      var CERT_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
      var type = CERT_TYPES[ext];
      if (!type) {
        setMsg(msg, "PDF, JPG, PNG, WEBP 파일만 올릴 수 있습니다.", "error");
        return;
      }
      var path = category.value + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;

      submitBtn.disabled = true;
      setMsg(msg, "업로드 중...");
      // 파일 형식 이름은 브라우저/설치 프로그램마다 다를 수 있어 확장자 기준 표준 형식으로 다시 감싼다.
      var up = await sb.storage.from("resources").upload(path, new Blob([f], { type: type }), { contentType: type });
      if (up.error) {
        submitBtn.disabled = false;
        setMsg(msg, "업로드하지 못했습니다: " + up.error.message, "error");
        return;
      }
      var res = await sb.from("resources").insert({
        category: category.value,
        title: title.value.trim(),
        description: desc.value.trim() || null,
        file_path: path,
        file_type: type
      });
      submitBtn.disabled = false;
      if (res.error) {
        await sb.storage.from("resources").remove([path]);
        setMsg(msg, "저장하지 못했습니다: " + res.error.message, "error");
        return;
      }
      form.reset();
      setMsg(msg, "업로드했습니다.", "ok");
      load();
    }

    load();
  }

  // ---------------- MSDS ----------------
  // 파일 이름에서 제품코드·제품명·개정일을 추측한다. 예) "DY1-BE001 에폭시 분체도료 MSDS 2025.03.10.pdf"
  function guessFromFileName(fileName) {
    var base = fileName.replace(/\.[a-z0-9]+$/i, "");
    var revised = "";
    var dateMatch = base.match(/(20\d{2})[.\-_ ]?(\d{2})[.\-_ ]?(\d{2})/);
    if (dateMatch) {
      revised = dateMatch[1] + "-" + dateMatch[2] + "-" + dateMatch[3];
      base = base.replace(dateMatch[0], " ");
    }
    base = base.replace(/\(?\bM\.?S\.?D\.?S\b\)?/gi, " ").replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim();
    var code = "";
    var codeMatch = base.match(/^([A-Za-z]{1,5}#?\d*[-.]?[A-Za-z]{0,4}[-.]?\d{2,5}[A-Za-z]?)\b/);
    if (codeMatch) {
      code = codeMatch[1];
      base = base.slice(codeMatch[0].length);
    }
    var name = base.replace(/^[\s\-–·.]+|[\s\-–·.]+$/g, "");
    return { code: code, name: name, revised: revised };
  }

  function formatDate(iso) {
    return iso ? iso.replace(/-/g, ".") : "";
  }

  // MSDS로 받는 파일 형식: PDF, 엑셀
  var MSDS_TYPES = {
    pdf: "application/pdf",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };

  function msdsExt(fileName) {
    var m = fileName.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : "";
  }

  // 브라우저가 파일을 못 읽거나 서버에 닿지 못했을 때의 오류를 알기 쉬운 문장으로
  function uploadErrorText(err) {
    var text = (err && err.message) || String(err);
    if (/failed to fetch|networkerror|load failed/i.test(text)) {
      return "파일을 보내지 못했습니다. 파일이 엑셀 등 다른 프로그램에서 열려 있으면 닫고 다시 시도하세요. 계속되면 인터넷 연결을 확인해 주세요.";
    }
    if (/mime|not supported|invalid.*type/i.test(text)) {
      return "지원하지 않는 파일 형식입니다 (PDF, XLS, XLSX만 가능).";
    }
    return text;
  }

  // 원본 보관함(비공개 msds-archive 버킷) 경로: msds/2026-10/1790....-abc123.xls
  function archivePathFor(ext) {
    var d = new Date();
    var ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    return "msds/" + ym + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  }

  async function renderMsds() {
    var seriesList = el("datalist", { id: "msds-series-list" });
    var picker = el("input", { type: "file", multiple: true, accept: ".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var bulkSeries = el("input", { type: "text", maxlength: "100", list: "msds-series-list", placeholder: "예: 자동차보수용" });
    var bulkApply = el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "전체에 적용", onclick: applyBulkSeries });
    var bulkRow = el("div", { class: "a-row a-bulk", hidden: true }, [el("span", { class: "a-list-meta", text: "구분(시리즈) 한 번에 입력:" }), bulkSeries, bulkApply]);
    var previewBody = el("tbody");
    var previewWrap = el("div", { class: "a-table-wrap", hidden: true }, [
      el("table", { class: "a-table" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "파일" }),
          el("th", { text: "구분(시리즈)" }),
          el("th", { text: "제품명" }),
          el("th", { text: "제품코드" }),
          el("th", { text: "MSDS NO" }),
          el("th", { text: "개정일" }),
          el("th", { text: "상태" })
        ])]),
        previewBody
      ])
    ]);
    var uploadBtn = el("button", { class: "a-btn", type: "button", text: "업로드", hidden: true, onclick: uploadAll });
    var clearBtn = el("button", { class: "a-btn a-btn--ghost", type: "button", text: "선택 취소", hidden: true, onclick: clearPicked });
    var upMsg = msgNode();
    var picked = [];

    var archiveBody = el("tbody");
    var archiveCount = el("span", { class: "a-list-meta" });
    var archiveMsg = msgNode();

    var search = el("input", { type: "search", placeholder: "구분·제품명·제품코드·MSDS NO 검색" });
    var countText = el("span", { class: "a-list-meta" });
    var listBody = el("tbody");
    var listMsg = msgNode();
    var rows = [];

    main.replaceChildren.apply(main, header("MSDS", "올린 MSDS는 홈페이지 MSDS 페이지에 MSDS NO·구분·제품명·제품코드·다운로드 표로 표시됩니다. 같은 MSDS NO가 이미 있거나 고른 파일끼리 겹치면 노란색으로 표시됩니다. 최근에 올린 것이 위에 나옵니다.").concat([
      seriesList,
      el("section", { class: "a-card" }, [
        el("h2", { text: "여러 파일 한 번에 올리기" }),
        el("label", { class: "a-field" }, [
          "MSDS 파일 선택 (PDF · 엑셀)",
          el("small", { text: "PDF, XLS, XLSX · 여러 개를 한꺼번에 선택할 수 있습니다 · 파일당 최대 20MB · 엑셀은 파일 안의 품명·제품코드·MSDS NO·최종개정일자를, PDF는 파일 이름을 읽어 자동으로 채우니 올리기 전에 확인·수정해 주세요." }),
          picker
        ]),
        bulkRow,
        previewWrap,
        el("div", { class: "a-row" }, [uploadBtn, clearBtn]),
        upMsg
      ]),
      el("section", { class: "a-card a-card--gap" }, [
        el("div", { class: "a-card-head" }, [el("h2", { text: "등록된 MSDS" }), countText]),
        el("label", { class: "a-field" }, [search]),
        el("div", { class: "a-table-wrap" }, [
          el("table", { class: "a-table" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "번호" }),
              el("th", { text: "구분" }),
              el("th", { text: "제품명" }),
              el("th", { text: "제품코드" }),
              el("th", { text: "MSDS NO" }),
              el("th", { text: "개정일" }),
              el("th", { text: "" })
            ])]),
            listBody
          ])
        ]),
        listMsg
      ]),
      el("section", { class: "a-card a-card--gap" }, [
        el("div", { class: "a-card-head" }, [el("h2", { text: "원본 보관함" }), archiveCount]),
        el("p", { class: "a-list-meta", text: "등록할 때 원본 파일이 관리자만 볼 수 있는 비공개 저장소(msds-archive)에 자동으로 복사됩니다. 홈페이지에서 MSDS를 삭제해도 원본은 여기 남습니다." }),
        el("div", { class: "a-table-wrap" }, [
          el("table", { class: "a-table" }, [
            el("thead", {}, [el("tr", {}, [
              el("th", { text: "보관일" }),
              el("th", { text: "원본 파일명" }),
              el("th", { text: "제품코드" }),
              el("th", { text: "제품명" }),
              el("th", { text: "홈페이지" }),
              el("th", { text: "" })
            ])]),
            archiveBody
          ])
        ]),
        archiveMsg
      ])
    ]));

    // 보관함에 원본 복사본을 남긴다. body가 없으면(이미 등록된 파일) 공개 저장소에서 서버 쪽 복사.
    async function archiveCopy(row, opts) {
      var ext = msdsExt(row.file_path) || "bin";
      var archivePath = archivePathFor(ext);
      var res;
      try {
        res = opts.body
          ? await sb.storage.from("msds-archive").upload(archivePath, opts.body, { contentType: row.file_type })
          : await sb.storage.from("resources").copy(row.file_path, archivePath, { destinationBucket: "msds-archive" });
      } catch (err) {
        res = { error: err };
      }
      if (res.error) {
        return res.error;
      }
      var ins = await sb.from("msds_archive").insert({
        resource_id: row.id,
        archive_path: archivePath,
        original_name: opts.originalName,
        file_type: row.file_type,
        file_size: opts.size || null,
        series: row.series || null,
        product_code: row.product_code || null,
        product_name: row.product_name || null,
        msds_no: row.msds_no || null
      });
      return ins.error || null;
    }

    async function loadArchive() {
      var res = await sb.from("msds_archive").select("*").order("created_at", { ascending: false });
      archiveBody.replaceChildren();
      if (res.error) {
        setMsg(archiveMsg, "보관함 목록을 불러오지 못했습니다: " + res.error.message, "error");
        return;
      }
      archiveCount.textContent = "전체 " + res.data.length + "개";
      if (!res.data.length) {
        archiveBody.appendChild(el("tr", {}, [el("td", { class: "a-empty", colspan: "6", text: "보관된 파일이 없습니다." })]));
        return;
      }
      res.data.forEach(function (a) {
        archiveBody.appendChild(el("tr", {}, [
          el("td", { class: "a-cell-no", text: A.formatDateTime(a.created_at) }),
          el("td", { class: "a-cell-file", text: a.original_name }),
          el("td", { text: a.product_code || "-" }),
          el("td", { text: a.product_name || "-" }),
          el("td", { text: a.resource_id ? "게시 중" : "삭제됨" }),
          el("td", { class: "a-cell-actions" }, [
            el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "다운로드", onclick: function () { downloadArchived(a); } })
          ])
        ]));
      });
    }

    async function downloadArchived(a) {
      var res = await sb.storage.from("msds-archive").createSignedUrl(a.archive_path, 60, { download: a.original_name });
      if (res.error) {
        setMsg(archiveMsg, "다운로드 주소를 만들지 못했습니다: " + res.error.message, "error");
        return;
      }
      window.location.href = res.data.signedUrl;
    }

    // 보관함이 생기기 전에 등록된 MSDS도 보관함에 한 번 복사해 둔다.
    async function syncArchive() {
      var have = await sb.from("msds_archive").select("resource_id");
      if (have.error) {
        return;
      }
      var archived = {};
      have.data.forEach(function (a) {
        if (a.resource_id) {
          archived[a.resource_id] = true;
        }
      });
      var missing = rows.filter(function (r) { return !archived[r.id]; });
      if (!missing.length) {
        return;
      }
      var failed = 0;
      for (var i = 0; i < missing.length; i++) {
        var r = missing[i];
        setMsg(archiveMsg, "기존 MSDS를 보관함에 복사하는 중... " + (i + 1) + " / " + missing.length);
        var name = [r.product_code, r.product_name || r.title].filter(Boolean).join(" ") + "." + (msdsExt(r.file_path) || "bin");
        if (await archiveCopy(r, { originalName: name })) {
          failed++;
        }
      }
      setMsg(archiveMsg, failed ? failed + "개를 보관함에 복사하지 못했습니다. 페이지를 새로 고치면 다시 시도합니다." : "기존 MSDS " + missing.length + "개를 보관함에 복사했습니다.", failed ? "error" : "ok");
      loadArchive();
    }

    function refreshSeriesOptions() {
      var seen = {};
      seriesList.replaceChildren();
      rows.forEach(function (r) {
        if (r.series && !seen[r.series]) {
          seen[r.series] = true;
          seriesList.appendChild(el("option", { value: r.series }));
        }
      });
    }

    picker.addEventListener("change", function () {
      picked = Array.prototype.slice.call(picker.files).map(function (f) {
        var g = guessFromFileName(f.name);
        return {
          file: f,
          series: el("input", { type: "text", maxlength: "100", list: "msds-series-list", value: bulkSeries.value.trim() }),
          name: el("input", { type: "text", maxlength: "200", value: g.name }),
          code: el("input", { type: "text", maxlength: "100", value: g.code }),
          msdsNo: el("input", { type: "text", maxlength: "100", value: "" }),
          revised: el("input", { type: "date", value: g.revised }),
          status: el("span", { class: "a-list-meta", text: !MSDS_TYPES[msdsExt(f.name)] ? "형식 불가 (PDF·XLS·XLSX만)" : f.size > 20 * 1024 * 1024 ? "20MB 초과" : "대기" }),
          done: false
        };
      });
      previewBody.replaceChildren.apply(previewBody, picked.map(function (p) {
        p.dupNote = el("small", { class: "a-dup-note", hidden: true });
        p.msdsNo.addEventListener("input", checkDuplicates);
        p.tr = el("tr", {}, [
          el("td", { class: "a-cell-file", text: p.file.name }),
          el("td", {}, [p.series]),
          el("td", {}, [p.name]),
          el("td", {}, [p.code]),
          el("td", {}, [p.msdsNo, p.dupNote]),
          el("td", {}, [p.revised]),
          el("td", {}, [p.status])
        ]);
        return p.tr;
      }));
      var any = picked.length > 0;
      previewWrap.hidden = !any;
      bulkRow.hidden = !any;
      uploadBtn.hidden = !any;
      clearBtn.hidden = !any;
      uploadBtn.textContent = picked.length + "개 업로드";
      setMsg(upMsg, "");
      checkDuplicates();
      readExcelContents(picked);
    });

    // MSDS NO 중복 표시: 이미 등록된 것 또는 이번에 고른 파일끼리 같으면 노란색으로 칠한다.
    function normNo(v) {
      return String(v || "").replace(/\s+/g, "").toUpperCase();
    }

    function checkDuplicates() {
      var registered = {};
      rows.forEach(function (r) {
        var k = normNo(r.msds_no);
        if (k) {
          registered[k] = r;
        }
      });
      var inBatch = {};
      picked.forEach(function (p) {
        var k = normNo(p.msdsNo.value);
        if (k) {
          inBatch[k] = (inBatch[k] || 0) + 1;
        }
      });
      var count = 0;
      picked.forEach(function (p) {
        if (!p.tr || p.done) {
          return;
        }
        var k = normNo(p.msdsNo.value);
        var notes = [];
        if (k && registered[k]) {
          var r = registered[k];
          notes.push("이미 등록됨: " + (r.product_name || r.title) + (r.product_code ? " (" + r.product_code + ")" : ""));
        }
        if (k && inBatch[k] > 1) {
          notes.push("선택한 파일 중 같은 번호 " + inBatch[k] + "개");
        }
        p.dup = notes.length > 0;
        p.tr.classList.toggle("is-dup", p.dup);
        p.dupNote.hidden = !p.dup;
        p.dupNote.textContent = notes.length ? "MSDS NO 중복 · " + notes.join(" · ") : "";
        if (p.dup) {
          count++;
        }
      });
      return count;
    }

    // 엑셀 MSDS는 파일 안의 품명·제품코드·MSDS NO·최종개정일자를 읽어 칸을 채운다 (파일 이름에서 추측한 값보다 우선).
    async function readExcelContents(list) {
      var excel = list.filter(function (p) { return /^xlsx?$/.test(msdsExt(p.file.name)); });
      if (!excel.length) {
        return;
      }
      if (!window.DY_MSDS_PARSE || !window.XLSX) {
        setMsg(upMsg, "엑셀 내용을 읽는 도구를 불러오지 못했습니다. 파일 이름에서 채운 값을 확인해 주세요.", "error");
        return;
      }
      uploadBtn.disabled = true;
      var read = 0;
      for (var i = 0; i < excel.length; i++) {
        var p = excel[i];
        if (picked.indexOf(p) === -1) {
          return;
        }
        p.status.textContent = "파일 읽는 중";
        try {
          var info = await window.DY_MSDS_PARSE(p.file);
          if (info.name) { p.name.value = info.name; }
          if (info.code) { p.code.value = info.code; }
          if (info.msdsNo) { p.msdsNo.value = info.msdsNo; }
          if (info.revised) { p.revised.value = info.revised; }
          checkDuplicates();
          var found = [info.name && "품명", info.code && "코드", info.msdsNo && "MSDS NO", info.revised && "개정일"].filter(Boolean);
          p.status.textContent = found.length ? "파일에서 읽음 (" + found.join("·") + ")" : "파일에서 못 찾음 · 직접 입력";
          if (found.length) { read++; }
        } catch (err) {
          p.status.textContent = "파일을 읽지 못함 · 직접 입력";
        }
      }
      uploadBtn.disabled = false;
      setMsg(upMsg, "엑셀 " + excel.length + "개 중 " + read + "개에서 내용을 읽었습니다. 올리기 전에 확인해 주세요.", "ok");
    }

    function applyBulkSeries() {
      picked.forEach(function (p) {
        if (!p.done) {
          p.series.value = bulkSeries.value.trim();
        }
      });
    }

    function clearPicked() {
      picked = [];
      picker.value = "";
      previewBody.replaceChildren();
      previewWrap.hidden = true;
      bulkRow.hidden = true;
      uploadBtn.hidden = true;
      clearBtn.hidden = true;
      setMsg(upMsg, "");
    }

    async function uploadAll() {
      var todo = picked.filter(function (p) { return !p.done; });
      var dups = checkDuplicates();
      if (dups && !confirm("MSDS NO가 중복된 파일이 " + dups + "개 있습니다 (노란색 표시). 그래도 올릴까요?")) {
        return;
      }
      uploadBtn.disabled = true;
      clearBtn.disabled = true;
      var ok = 0;
      var failed = 0;
      for (var i = 0; i < todo.length; i++) {
        var p = todo[i];
        setMsg(upMsg, "업로드 중... " + (i + 1) + " / " + todo.length);
        if (p.file.size > 20 * 1024 * 1024) {
          p.status.textContent = "실패: 20MB 초과";
          failed++;
          continue;
        }
        var code = p.code.value.trim();
        var name = p.name.value.trim();
        var ext = msdsExt(p.file.name);
        var type = MSDS_TYPES[ext];
        if (!type) {
          p.status.textContent = "실패: PDF, XLS, XLSX만 올릴 수 있습니다";
          failed++;
          continue;
        }
        var path = "msds/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
        p.status.textContent = "올리는 중";
        var up;
        try {
          // 한컴오피스가 깔린 PC는 엑셀 형식을 "application/haansoftxls" 같은 이름으로 넘기므로, 확장자에 맞는 표준 형식으로 다시 감싸서 보낸다.
          var body = new Blob([p.file], { type: type });
          up = await sb.storage.from("resources").upload(path, body, { contentType: type });
        } catch (err) {
          up = { error: err };
        }
        if (up.error) {
          p.status.textContent = "실패: " + uploadErrorText(up.error);
          failed++;
          continue;
        }
        var row = {
          category: "msds",
          title: name || code || p.file.name.replace(/\.[a-z0-9]+$/i, ""),
          series: p.series.value.trim() || null,
          product_code: code || null,
          product_name: name || null,
          msds_no: p.msdsNo.value.trim() || null,
          revised_on: p.revised.value || null,
          file_path: path,
          file_type: type
        };
        var res = await sb.from("resources").insert(row).select("id").single();
        if (res.error) {
          await sb.storage.from("resources").remove([path]);
          p.status.textContent = "실패: " + res.error.message;
          failed++;
          continue;
        }
        p.done = true;
        row.id = res.data.id;
        var archErr = await archiveCopy(row, { body: body, originalName: p.file.name, size: p.file.size });
        p.status.textContent = archErr ? "완료 (보관함 복사 실패: " + uploadErrorText(archErr) + ")" : "완료 · 보관함 저장";
        ok++;
      }
      uploadBtn.disabled = false;
      clearBtn.disabled = false;
      setMsg(upMsg, ok + "개 올렸습니다." + (failed ? " " + failed + "개는 실패했습니다. 상태 칸을 확인하고 다시 [업로드]를 누르면 실패한 것만 다시 올립니다." : ""), failed ? "error" : "ok");
      if (!failed) {
        uploadBtn.hidden = true;
      }
      load();
      loadArchive();
    }

    function matches(row, q) {
      if (!q) {
        return true;
      }
      return [row.series, row.product_code, row.product_name, row.msds_no, row.title].some(function (v) {
        return v && v.toLowerCase().indexOf(q) !== -1;
      });
    }

    function paint() {
      var q = search.value.trim().toLowerCase();
      var shown = rows.filter(function (r) { return matches(r, q); });
      countText.textContent = q ? shown.length + " / " + rows.length + "개" : "전체 " + rows.length + "개";
      listBody.replaceChildren();
      if (!shown.length) {
        listBody.appendChild(el("tr", {}, [el("td", { class: "a-empty", colspan: "7", text: rows.length ? "검색 결과가 없습니다." : "등록된 MSDS가 없습니다." })]));
        return;
      }
      shown.forEach(function (row) {
        listBody.appendChild(viewRow(row));
      });
    }

    function viewRow(row) {
      var tr = el("tr", {}, [
        el("td", { class: "a-cell-no", text: String(row.no) }),
        el("td", { text: row.series || "-" }),
        el("td", { text: row.product_name || row.title }),
        el("td", { text: row.product_code || "-" }),
        el("td", { text: row.msds_no || "-" }),
        el("td", { text: formatDate(row.revised_on) || "-" }),
        el("td", { class: "a-cell-actions" }, [el("div", { class: "a-row" }, [
          el("a", { class: "a-btn a-btn--ghost a-btn--sm", href: window.DY_RESOURCE_URL(row.file_path, window.DY_MSDS_FILENAME(row)), text: "다운로드" }),
          el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "수정", onclick: function () { tr.replaceWith(editRow(row)); } }),
          el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: function () { remove(row); } })
        ])])
      ]);
      return tr;
    }

    function editRow(row) {
      var series = el("input", { type: "text", maxlength: "100", list: "msds-series-list", value: row.series || "" });
      var name = el("input", { type: "text", maxlength: "200", value: row.product_name || row.title });
      var code = el("input", { type: "text", maxlength: "100", value: row.product_code || "" });
      var msdsNo = el("input", { type: "text", maxlength: "100", value: row.msds_no || "" });
      var revised = el("input", { type: "date", value: row.revised_on || "" });
      var tr = el("tr", { class: "is-editing" }, [
        el("td", { class: "a-cell-no", text: String(row.no) }),
        el("td", {}, [series]),
        el("td", {}, [name]),
        el("td", {}, [code]),
        el("td", {}, [msdsNo]),
        el("td", {}, [revised]),
        el("td", { class: "a-cell-actions" }, [el("div", { class: "a-row" }, [
          el("button", { class: "a-btn a-btn--sm", type: "button", text: "저장", onclick: save }),
          el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "취소", onclick: function () { tr.replaceWith(viewRow(row)); } })
        ])])
      ]);
      async function save() {
        var payload = {
          series: series.value.trim() || null,
          product_code: code.value.trim() || null,
          product_name: name.value.trim() || null,
          msds_no: msdsNo.value.trim() || null,
          revised_on: revised.value || null
        };
        payload.title = payload.product_name || payload.product_code || row.title;

        // 엑셀 MSDS면 파일 안의 품명·제품코드·MSDS NO·개정일도 같이 바꾼다 (원본은 보관함에 그대로 남음).
        var fileNote = "";
        var oldPath = null;
        if (/^xlsx?$/.test(msdsExt(row.file_path))) {
          setMsg(listMsg, "엑셀 파일을 수정하는 중...");
          var fx = await rewriteExcelFile(row, payload);
          if (fx.error) {
            fileNote = " 엑셀 파일은 수정하지 못했습니다: " + fx.error;
          } else if (fx.path) {
            oldPath = row.file_path;
            payload.file_path = fx.path;
            fileNote = " 엑셀 파일도 " + fx.changed + "곳 수정했습니다." + (fx.missing.length ? " (파일에 없는 항목: " + fx.missing.join(", ") + ")" : "");
          } else if (fx.note) {
            fileNote = " " + fx.note;
          }
        }

        var res = await sb.from("resources").update(payload).eq("id", row.id);
        if (res.error) {
          if (payload.file_path) {
            await sb.storage.from("resources").remove([payload.file_path]);
          }
          setMsg(listMsg, "저장하지 못했습니다: " + res.error.message, "error");
          return;
        }
        if (oldPath) {
          await sb.storage.from("resources").remove([oldPath]);
        }
        Object.assign(row, payload);
        refreshSeriesOptions();
        setMsg(listMsg, "저장했습니다." + fileNote, fileNote.indexOf("못했습니다") !== -1 ? "error" : "ok");
        tr.replaceWith(viewRow(row));
      }
      return tr;
    }

    // 공개 저장소의 엑셀 파일을 내려받아 값만 바꾼 새 파일로 올린다. 브라우저 캐시 문제를 피하려고 새 경로에 올리고,
    // 성공하면 호출한 쪽에서 목록의 file_path를 바꾸고 옛 파일을 지운다.
    async function rewriteExcelFile(row, payload) {
      if (!window.DY_MSDS_REWRITE || !window.DY_MSDS_EXTRACT || !window.XLSX) {
        return { error: "엑셀 도구를 불러오지 못했습니다" };
      }
      try {
        var resp = await fetch(window.DY_RESOURCE_URL(row.file_path), { cache: "no-store" });
        if (!resp.ok) {
          return { error: "파일을 내려받지 못했습니다 (" + resp.status + ")" };
        }
        var bytes = new Uint8Array(await resp.arrayBuffer());
        var before = window.DY_MSDS_EXTRACT(bytes, window.XLSX);
        var after = {
          name: payload.product_name || "",
          code: payload.product_code || "",
          msdsNo: payload.msds_no || "",
          revised: payload.revised_on || ""
        };
        var result = window.DY_MSDS_REWRITE(bytes, window.XLSX, before, after);
        if (!result.wanted) {
          return { note: result.missing.length ? "엑셀 파일에서 찾지 못한 항목이 있어 파일은 그대로 두었습니다: " + result.missing.join(", ") : "" };
        }
        if (result.lossy && !confirm("이 파일은 옛 엑셀 형식(.xls)이라 다시 저장하면 글꼴·색 같은 서식이 단순해질 수 있습니다.\n엑셀 파일 내용도 함께 수정할까요?\n(취소하면 목록 정보만 수정하고 파일은 그대로 둡니다. 원본은 보관함에 남아 있습니다.)")) {
          return { note: "엑셀 파일은 그대로 두었습니다." };
        }
        if (!result.changed) {
          return { note: "엑셀 파일에서 바꿀 값을 찾지 못해 파일은 그대로 두었습니다." };
        }
        var ext = msdsExt(row.file_path);
        var path = "msds/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
        var type = MSDS_TYPES[ext];
        var up = await sb.storage.from("resources").upload(path, new Blob([result.bytes], { type: type }), { contentType: type });
        if (up.error) {
          return { error: uploadErrorText(up.error) };
        }
        return { path: path, changed: result.changed, missing: result.missing };
      } catch (err) {
        return { error: uploadErrorText(err) };
      }
    }

    async function remove(row) {
      if (!confirm("'" + (row.product_name || row.title) + (row.product_code ? " (" + row.product_code + ")" : "") + "' MSDS를 삭제할까요? 홈페이지에서 사라지지만, 원본은 보관함에 남습니다.")) {
        return;
      }
      var st = await sb.storage.from("resources").remove([row.file_path]);
      if (st.error) {
        setMsg(listMsg, "파일을 삭제하지 못했습니다: " + st.error.message, "error");
        return;
      }
      var res = await sb.from("resources").delete().eq("id", row.id);
      if (res.error) {
        setMsg(listMsg, "삭제하지 못했습니다: " + res.error.message, "error");
        return;
      }
      setMsg(listMsg, "삭제했습니다. 원본은 보관함에 남아 있습니다.", "ok");
      load();
      loadArchive();
    }

    async function load() {
      // 먼저 올린 순서대로 번호를 매기고(1번이 가장 오래됨), 화면에는 최근 것부터 보여 준다.
      var res = await sb.from("resources").select("*").eq("category", "msds").order("created_at", { ascending: true }).order("id", { ascending: true });
      if (res.error) {
        setMsg(listMsg, "목록을 불러오지 못했습니다.", "error");
        return;
      }
      rows = res.data.map(function (row, i) {
        row.no = i + 1;
        return row;
      }).reverse();
      refreshSeriesOptions();
      paint();
      checkDuplicates();
    }

    // 이미 등록된 엑셀 MSDS 중 MSDS NO가 비어 있는 것은 파일을 열어 내용(MSDS NO·개정일 등)을 채운다.
    async function backfillExcelInfo() {
      if (!window.DY_MSDS_EXTRACT || !window.XLSX) {
        return;
      }
      var todo = rows.filter(function (r) { return !r.msds_no && /^xlsx?$/.test(msdsExt(r.file_path)); });
      var changed = 0;
      for (var i = 0; i < todo.length; i++) {
        var r = todo[i];
        try {
          var resp = await fetch(window.DY_RESOURCE_URL(r.file_path));
          if (!resp.ok) {
            continue;
          }
          var info = window.DY_MSDS_EXTRACT(new Uint8Array(await resp.arrayBuffer()), window.XLSX);
          var patch = {};
          if (info.msdsNo) { patch.msds_no = info.msdsNo; }
          if (info.revised && !r.revised_on) { patch.revised_on = info.revised; }
          if (info.code && !r.product_code) { patch.product_code = info.code; }
          if (info.name && !r.product_name) { patch.product_name = info.name; }
          if (!Object.keys(patch).length) {
            continue;
          }
          var up = await sb.from("resources").update(patch).eq("id", r.id);
          if (!up.error) {
            Object.assign(r, patch);
            changed++;
          }
        } catch (err) {
          // 읽지 못한 파일은 다음에 다시 시도
        }
      }
      if (changed) {
        setMsg(listMsg, "기존 엑셀 MSDS " + changed + "개의 MSDS NO·개정일을 파일에서 읽어 채웠습니다.", "ok");
        paint();
      }
    }

    search.addEventListener("input", paint);
    loadArchive();
    load().then(function () {
      return syncArchive();
    }).then(backfillExcelInfo);
  }

  // ---------------- 공통 ----------------
  var TABS = {
    notices: renderNotices,
    inquiries: renderInquiries,
    careers: renderCareers,
    msds: renderMsds,
    resources: renderResources
  };

  async function refreshNewCount() {
    var res = await sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new");
    var badge = document.getElementById("new-count");
    if (!res.error && res.count) {
      badge.textContent = String(res.count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function route() {
    var tab = location.hash.slice(1);
    if (!TABS[tab]) {
      tab = "notices";
    }
    document.querySelectorAll("[data-tab]").forEach(function (link) {
      if (link.getAttribute("data-tab") === tab) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    TABS[tab]();
  }

  document.getElementById("logout").addEventListener("click", async function () {
    await sb.auth.signOut();
    location.replace("login.html");
  });

  A.checkAdmin().then(async function (ok) {
    if (!ok) {
      var session = await sb.auth.getSession();
      if (session.data.session) {
        await sb.auth.signOut();
        location.replace("login.html?reason=not-admin");
      } else {
        location.replace("login.html");
      }
      return;
    }
    var user = await sb.auth.getUser();
    document.getElementById("panel-email").textContent = user.data.user ? user.data.user.email : "";
    // 다른 탭에서 로그아웃하거나 세션이 만료되면 로그인 화면으로
    sb.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") {
        location.replace("login.html");
      }
    });
    window.addEventListener("hashchange", route);
    route();
    refreshNewCount();
  });
})();
