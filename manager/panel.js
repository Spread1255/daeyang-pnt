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
            el("a", { class: "a-btn a-btn--ghost a-btn--sm", href: window.DY_RESOURCE_URL(row.file_path), target: "_blank", rel: "noopener", text: "보기" }),
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
      var path = category.value + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;

      submitBtn.disabled = true;
      setMsg(msg, "업로드 중...");
      var up = await sb.storage.from("resources").upload(path, f, { contentType: f.type });
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
        file_type: f.type
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

  async function renderMsds() {
    var picker = el("input", { type: "file", multiple: true, accept: "application/pdf" });
    var previewBody = el("tbody");
    var previewWrap = el("div", { class: "a-table-wrap", hidden: true }, [
      el("table", { class: "a-table" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", { text: "파일" }),
          el("th", { text: "제품코드" }),
          el("th", { text: "제품명" }),
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

    var search = el("input", { type: "search", placeholder: "제품코드 또는 제품명 검색" });
    var countText = el("span", { class: "a-list-meta" });
    var listBody = el("tbody");
    var listMsg = msgNode();
    var rows = [];

    main.replaceChildren.apply(main, header("MSDS", "올린 MSDS는 홈페이지 MSDS 페이지에 표로 표시되고, 방문자가 제품코드·제품명으로 검색할 수 있습니다.").concat([
      el("section", { class: "a-card" }, [
        el("h2", { text: "여러 파일 한 번에 올리기" }),
        el("label", { class: "a-field" }, [
          "PDF 파일 선택",
          el("small", { text: "여러 개를 한꺼번에 선택할 수 있습니다 · 파일당 최대 20MB · 파일 이름에서 제품코드·제품명·개정일을 자동으로 채우니, 올리기 전에 확인·수정해 주세요." }),
          picker
        ]),
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
              el("th", { text: "제품코드" }),
              el("th", { text: "제품명" }),
              el("th", { text: "개정일" }),
              el("th", { text: "" })
            ])]),
            listBody
          ])
        ]),
        listMsg
      ])
    ]));

    picker.addEventListener("change", function () {
      picked = Array.prototype.slice.call(picker.files).map(function (f) {
        var g = guessFromFileName(f.name);
        return {
          file: f,
          code: el("input", { type: "text", maxlength: "100", value: g.code }),
          name: el("input", { type: "text", maxlength: "200", value: g.name }),
          revised: el("input", { type: "date", value: g.revised }),
          status: el("span", { class: "a-list-meta", text: f.size > 20 * 1024 * 1024 ? "20MB 초과" : "대기" }),
          done: false
        };
      });
      previewBody.replaceChildren.apply(previewBody, picked.map(function (p) {
        return el("tr", {}, [
          el("td", { class: "a-cell-file", text: p.file.name }),
          el("td", {}, [p.code]),
          el("td", {}, [p.name]),
          el("td", {}, [p.revised]),
          el("td", {}, [p.status])
        ]);
      }));
      var any = picked.length > 0;
      previewWrap.hidden = !any;
      uploadBtn.hidden = !any;
      clearBtn.hidden = !any;
      uploadBtn.textContent = picked.length + "개 업로드";
      setMsg(upMsg, "");
    });

    function clearPicked() {
      picked = [];
      picker.value = "";
      previewBody.replaceChildren();
      previewWrap.hidden = true;
      uploadBtn.hidden = true;
      clearBtn.hidden = true;
      setMsg(upMsg, "");
    }

    async function uploadAll() {
      var todo = picked.filter(function (p) { return !p.done; });
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
        var path = "msds/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".pdf";
        p.status.textContent = "올리는 중";
        var up = await sb.storage.from("resources").upload(path, p.file, { contentType: "application/pdf" });
        if (up.error) {
          p.status.textContent = "실패: " + up.error.message;
          failed++;
          continue;
        }
        var res = await sb.from("resources").insert({
          category: "msds",
          title: name || code || p.file.name.replace(/\.pdf$/i, ""),
          product_code: code || null,
          product_name: name || null,
          revised_on: p.revised.value || null,
          file_path: path,
          file_type: "application/pdf"
        });
        if (res.error) {
          await sb.storage.from("resources").remove([path]);
          p.status.textContent = "실패: " + res.error.message;
          failed++;
          continue;
        }
        p.done = true;
        p.status.textContent = "완료";
        ok++;
      }
      uploadBtn.disabled = false;
      clearBtn.disabled = false;
      setMsg(upMsg, ok + "개 올렸습니다." + (failed ? " " + failed + "개는 실패했습니다. 상태 칸을 확인하고 다시 [업로드]를 누르면 실패한 것만 다시 올립니다." : ""), failed ? "error" : "ok");
      if (!failed) {
        uploadBtn.hidden = true;
      }
      load();
    }

    function matches(row, q) {
      if (!q) {
        return true;
      }
      return [row.product_code, row.product_name, row.title].some(function (v) {
        return v && v.toLowerCase().indexOf(q) !== -1;
      });
    }

    function paint() {
      var q = search.value.trim().toLowerCase();
      var shown = rows.filter(function (r) { return matches(r, q); });
      countText.textContent = q ? shown.length + " / " + rows.length + "개" : rows.length + "개";
      listBody.replaceChildren();
      if (!shown.length) {
        listBody.appendChild(el("tr", {}, [el("td", { class: "a-empty", colspan: "4", text: rows.length ? "검색 결과가 없습니다." : "등록된 MSDS가 없습니다." })]));
        return;
      }
      shown.forEach(function (row) {
        listBody.appendChild(viewRow(row));
      });
    }

    function viewRow(row) {
      var tr = el("tr", {}, [
        el("td", { text: row.product_code || "-" }),
        el("td", { text: row.product_name || row.title }),
        el("td", { text: formatDate(row.revised_on) || "-" }),
        el("td", { class: "a-cell-actions" }, [el("div", { class: "a-row" }, [
          el("a", { class: "a-btn a-btn--ghost a-btn--sm", href: window.DY_RESOURCE_URL(row.file_path), target: "_blank", rel: "noopener", text: "보기" }),
          el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "수정", onclick: function () { tr.replaceWith(editRow(row)); } }),
          el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: function () { remove(row); } })
        ])])
      ]);
      return tr;
    }

    function editRow(row) {
      var code = el("input", { type: "text", maxlength: "100", value: row.product_code || "" });
      var name = el("input", { type: "text", maxlength: "200", value: row.product_name || row.title });
      var revised = el("input", { type: "date", value: row.revised_on || "" });
      var tr = el("tr", { class: "is-editing" }, [
        el("td", {}, [code]),
        el("td", {}, [name]),
        el("td", {}, [revised]),
        el("td", { class: "a-cell-actions" }, [el("div", { class: "a-row" }, [
          el("button", { class: "a-btn a-btn--sm", type: "button", text: "저장", onclick: save }),
          el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "취소", onclick: function () { tr.replaceWith(viewRow(row)); } })
        ])])
      ]);
      async function save() {
        var payload = {
          product_code: code.value.trim() || null,
          product_name: name.value.trim() || null,
          revised_on: revised.value || null
        };
        payload.title = payload.product_name || payload.product_code || row.title;
        var res = await sb.from("resources").update(payload).eq("id", row.id);
        if (res.error) {
          setMsg(listMsg, "저장하지 못했습니다: " + res.error.message, "error");
          return;
        }
        Object.assign(row, payload);
        setMsg(listMsg, "저장했습니다.", "ok");
        tr.replaceWith(viewRow(row));
      }
      return tr;
    }

    async function remove(row) {
      if (!confirm("'" + (row.product_code ? row.product_code + " " : "") + (row.product_name || row.title) + "' MSDS를 삭제할까요? 홈페이지에서도 사라집니다.")) {
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
      setMsg(listMsg, "삭제했습니다.", "ok");
      load();
    }

    async function load() {
      var res = await sb.from("resources").select("*").eq("category", "msds").order("product_code", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
      if (res.error) {
        setMsg(listMsg, "목록을 불러오지 못했습니다.", "error");
        return;
      }
      rows = res.data;
      paint();
    }

    search.addEventListener("input", paint);
    load();
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
