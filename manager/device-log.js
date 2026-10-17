// 관리자 패널: 장치 기록 (시험·생산 기록 → 확정 기준값 → 현장 출력)
//  테이블: device_fields(기록 항목) / device_logs(기록 데이터) / device_standards(확정 기준값)
//  처음 쓰기 전에 supabase/device_logs.sql 을 Supabase SQL Editor에서 한 번 실행해야 한다.
(function () {
  var A = window.DY_ADMIN;
  var VIEW_KEY = "dy-device-view";
  var VIEWS = [
    ["std", "확정 기준값"],
    ["logs", "기록 데이터"],
    ["fields", "항목 설정"]
  ];

  function readView() {
    try {
      return localStorage.getItem(VIEW_KEY) || "std";
    } catch (e) {
      return "std";
    }
  }

  function saveView(v) {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch (e) {
      /* 저장 못해도 동작에는 문제 없음 */
    }
  }

  function today() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function dotDate(iso) {
    return iso ? String(iso).slice(0, 10).replace(/-/g, ".") : "";
  }

  function setMsg(node, text, kind) {
    node.textContent = text;
    node.className = "a-msg" + (kind ? " is-" + kind : "");
  }

  function missingTable(err) {
    return err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|schema cache/i.test(err.message || ""));
  }

  window.DY_DEVICE_LOG = async function (main) {
    var sb = A.sb;
    var el = A.el;
    var view = readView();
    var fields = [];
    var logs = [];
    var stds = [];
    var filter = { device: "", q: "", from: "", to: "" };
    // 기록 표에서 고른 값: { 항목id: { logId, value } }
    var picked = {};
    var pendingStd = null;

    var msg = el("p", { class: "a-msg", role: "status" });
    var body = el("div", { class: "dv-body" });
    var nav = el("div", { class: "dv-nav", role: "tablist", "aria-label": "장치 기록 목차" });
    var deviceList = el("datalist", { id: "dv-devices" });

    main.replaceChildren(
      el("h1", { class: "dv-noprint", text: "장치 기록" }),
      el("p", { class: "panel-lede dv-noprint", text: "장치별 시험·생산 기록을 남기고, 최종으로 정한 값은 확정 기준값으로 따로 모아 현장용으로 출력합니다." }),
      nav, msg, body, deviceList
    );

    function drawNav() {
      nav.replaceChildren.apply(nav, VIEWS.map(function (v) {
        var count = v[0] === "std" ? stds.length : v[0] === "logs" ? logs.length : fields.length;
        return el("button", {
          type: "button",
          role: "tab",
          class: "dv-nav-btn",
          "aria-selected": v[0] === view ? "true" : "false",
          onclick: function () {
            view = v[0];
            saveView(view);
            draw();
          }
        }, [v[1], el("span", { class: "dv-count", text: String(count) })]);
      }));
    }

    async function loadAll() {
      var res = await Promise.all([
        sb.from("device_fields").select("*").order("sort_order").order("created_at"),
        sb.from("device_logs").select("*").order("log_date", { ascending: false }).order("created_at", { ascending: false }),
        sb.from("device_standards").select("*").order("device").order("product_name")
      ]);
      var err = res[0].error || res[1].error || res[2].error;
      if (err) {
        body.replaceChildren();
        nav.replaceChildren();
        setMsg(msg, missingTable(err)
          ? "장치 기록용 테이블이 아직 없습니다. 저장소의 supabase/device_logs.sql 내용을 Supabase 대시보드 → SQL Editor에서 한 번 실행해 주세요."
          : "불러오지 못했습니다: " + err.message, "error");
        return false;
      }
      fields = res[0].data;
      logs = res[1].data;
      stds = res[2].data;
      var names = {};
      logs.concat(stds).forEach(function (r) {
        names[r.device] = true;
      });
      if (!Object.keys(names).length) {
        names["1호기"] = true;
      }
      deviceList.replaceChildren.apply(deviceList, Object.keys(names).sort(byDevice).map(function (n) {
        return el("option", { value: n });
      }));
      return true;
    }

    // "1호기, 2호기, 10호기" 처럼 숫자 순서대로
    function byDevice(a, b) {
      return String(a).localeCompare(String(b), "ko", { numeric: true });
    }

    function devices() {
      var names = {};
      logs.concat(stds).forEach(function (r) {
        names[r.device] = true;
      });
      return Object.keys(names).sort(byDevice);
    }

    function fieldHead(f) {
      return f.label + (f.unit ? " (" + f.unit + ")" : "");
    }

    function valText(v, f) {
      if (v === undefined || v === null || v === "") {
        return "";
      }
      return String(v) + (f.unit && /^[-+]?[\d.,]+$/.test(String(v)) ? " " + f.unit : "");
    }

    async function refresh() {
      if (await loadAll()) {
        draw();
      }
    }

    function draw() {
      drawNav();
      if (view === "logs") {
        drawLogs();
      } else if (view === "fields") {
        drawFields();
      } else {
        drawStds();
      }
    }

    // ---------------- 공통: 필터 막대 ----------------
    function filterBar(withDates, onChange) {
      var devSel = el("select", { "aria-label": "장치" }, [el("option", { value: "", text: "전체 장치" })].concat(devices().map(function (d) {
        return el("option", { value: d, text: d, selected: d === filter.device });
      })));
      var q = el("input", { type: "search", placeholder: "품명·코드 검색", value: filter.q });
      var from = withDates ? el("input", { type: "date", value: filter.from, "aria-label": "시작일" }) : null;
      var to = withDates ? el("input", { type: "date", value: filter.to, "aria-label": "종료일" }) : null;
      function apply() {
        filter.device = devSel.value;
        filter.q = q.value.trim();
        if (withDates) {
          filter.from = from.value;
          filter.to = to.value;
        }
        onChange();
      }
      devSel.addEventListener("change", apply);
      q.addEventListener("change", apply);
      if (withDates) {
        from.addEventListener("change", apply);
        to.addEventListener("change", apply);
      }
      return el("div", { class: "dv-filter dv-noprint" }, [
        devSel, q,
        withDates ? el("span", { class: "dv-range" }, [from, "~", to]) : null
      ]);
    }

    function match(r, withDates) {
      if (filter.device && r.device !== filter.device) {
        return false;
      }
      if (filter.q) {
        var hay = (r.product_name + " " + r.product_code + " " + r.memo).toLowerCase();
        if (hay.indexOf(filter.q.toLowerCase()) < 0) {
          return false;
        }
      }
      if (withDates && filter.from && r.log_date < filter.from) {
        return false;
      }
      if (withDates && filter.to && r.log_date > filter.to) {
        return false;
      }
      return true;
    }

    function printTitle(title, sub) {
      return el("div", { class: "dv-print-head" }, [
        el("strong", { text: "대양피앤티㈜ " + title }),
        el("span", { text: sub + " · 출력일 " + dotDate(today()) })
      ]);
    }

    function exportXlsx(name, header, rows) {
      if (!window.XLSX) {
        setMsg(msg, "엑셀 저장 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", "error");
        return;
      }
      var ws = window.XLSX.utils.aoa_to_sheet([header].concat(rows));
      var wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
      window.XLSX.writeFile(wb, name + "_" + today() + ".xlsx");
    }

    // 값 입력칸 (항목 설정에 따라 늘어남)
    function valueInputs(vals) {
      var inputs = {};
      var nodes = fields.map(function (f) {
        var input = el("input", { type: "text", inputmode: "decimal", maxlength: "60", value: vals && vals[f.id] != null ? vals[f.id] : "" });
        inputs[f.id] = input;
        return el("label", { class: "a-field dv-val-field" }, [fieldHead(f), input]);
      });
      return { nodes: nodes, read: function () {
        var out = {};
        fields.forEach(function (f) {
          var v = inputs[f.id].value.trim();
          if (v) {
            out[f.id] = v;
          }
        });
        return out;
      } };
    }

    function metaInputs(row) {
      var device = el("input", { type: "text", list: "dv-devices", maxlength: "40", required: true, placeholder: "예: 1호기", value: row.device || filter.device || "1호기" });
      var name = el("input", { type: "text", maxlength: "200", placeholder: "품명", value: row.product_name || "" });
      var code = el("input", { type: "text", maxlength: "80", placeholder: "예: DY#2-WH029", value: row.product_code || "" });
      return { device: device, name: name, code: code };
    }

    // ---------------- 기록 데이터 ----------------
    function drawLogs() {
      var editingId = null;
      var formMsg = el("p", { class: "a-msg", role: "status" });
      var meta = metaInputs({});
      var date = el("input", { type: "date", required: true, value: today() });
      var memo = el("textarea", { rows: "2", maxlength: "2000", placeholder: "선택 사항 · 특이사항" });
      var vals = valueInputs({});
      var formTitle = el("h2", { text: "새 기록" });
      var submitBtn = el("button", { class: "a-btn", type: "submit", text: "기록 추가" });
      var cancelBtn = el("button", { class: "a-btn a-btn--ghost", type: "button", text: "취소", hidden: true, onclick: reset });

      var form = el("form", { class: "a-card dv-noprint", onsubmit: submit }, [
        formTitle,
        el("div", { class: "dv-form-grid" }, [
          el("label", { class: "a-field" }, ["장치", meta.device]),
          el("label", { class: "a-field" }, ["날짜", date]),
          el("label", { class: "a-field" }, ["품명", meta.name]),
          el("label", { class: "a-field" }, ["코드", meta.code])
        ]),
        el("div", { class: "dv-form-grid" }, vals.nodes),
        fields.length ? null : el("p", { class: "a-hint", text: "기록할 항목이 없습니다. [항목 설정]에서 추가해 주세요." }),
        el("label", { class: "a-field" }, ["메모", memo]),
        el("div", { class: "a-row" }, [submitBtn, cancelBtn]),
        formMsg
      ]);

      function fill(row, asCopy) {
        meta.device.value = row.device;
        date.value = asCopy ? today() : row.log_date;
        meta.name.value = row.product_name;
        meta.code.value = row.product_code;
        memo.value = asCopy ? "" : row.memo;
        var fresh = valueInputs(row.vals);
        vals.nodes.forEach(function (n, i) {
          n.replaceWith(fresh.nodes[i]);
        });
        vals = fresh;
      }

      function reset() {
        editingId = null;
        var keep = { device: meta.device.value };
        form.reset();
        meta.device.value = keep.device || "1호기";
        date.value = today();
        fill({ device: meta.device.value, log_date: today(), product_name: "", product_code: "", memo: "", vals: {} }, true);
        formTitle.textContent = "새 기록";
        submitBtn.textContent = "기록 추가";
        cancelBtn.hidden = true;
      }

      async function submit(e) {
        e.preventDefault();
        var payload = {
          device: meta.device.value.trim(),
          log_date: date.value,
          product_name: meta.name.value.trim(),
          product_code: meta.code.value.trim(),
          vals: vals.read(),
          memo: memo.value.trim()
        };
        if (!payload.device) {
          setMsg(formMsg, "장치를 입력해 주세요.", "error");
          return;
        }
        submitBtn.disabled = true;
        var res = editingId
          ? await sb.from("device_logs").update(Object.assign(payload, { updated_at: new Date().toISOString() })).eq("id", editingId)
          : await sb.from("device_logs").insert(payload);
        submitBtn.disabled = false;
        if (res.error) {
          setMsg(formMsg, "저장하지 못했습니다: " + res.error.message, "error");
          return;
        }
        setMsg(msg, editingId ? "기록을 수정했습니다." : "기록을 추가했습니다.", "ok");
        refresh();
      }

      var list = el("section", { class: "a-card dv-sheet" });

      function renderList() {
        // 고른 값 막대
        var pickCount = Object.keys(picked).length;
        var pickBar = el("div", { class: "dv-pickbar dv-noprint" }, [
          el("span", { text: pickCount
            ? "고른 값 " + pickCount + "개 · 항목마다 하나씩 고를 수 있습니다."
            : "표의 값 칸을 눌러 기준값으로 쓸 값을 고르세요. 항목마다 다른 기록의 값을 고를 수 있습니다." }),
          el("div", { class: "a-row" }, [
            el("button", { class: "a-btn a-btn--sm", type: "button", text: "고른 값으로 기준값 정하기", disabled: !pickCount, onclick: function () {
              var first = null;
              var v = {};
              Object.keys(picked).forEach(function (fid) {
                v[fid] = picked[fid].value;
                if (!first) {
                  first = logs.find(function (r) { return r.id === picked[fid].logId; });
                }
              });
              toStandard(first || {}, v);
            } }),
            pickCount ? el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "선택 해제", onclick: function () {
              picked = {};
              renderList();
            } }) : null
          ])
        ]);

        var rows = logs.filter(function (r) { return match(r, true); });
        var stdSource = {};
        stds.forEach(function (s) {
          if (s.source_log_id) {
            stdSource[s.source_log_id] = true;
          }
        });

        var table = el("table", { class: "a-table dv-table" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { text: "날짜" }), el("th", { text: "장치" }), el("th", { text: "품명" }), el("th", { text: "코드" })
          ].concat(fields.map(function (f) {
            return el("th", { class: "dv-num", text: fieldHead(f) });
          })).concat([el("th", { text: "메모" }), el("th", { class: "dv-noprint", text: "" })]))]),
          el("tbody", {}, rows.length ? rows.map(function (r) {
            return el("tr", { class: stdSource[r.id] ? "is-std-source" : null }, [
              el("td", { class: "dv-nowrap", text: dotDate(r.log_date) }),
              el("td", { class: "dv-nowrap", text: r.device }),
              el("td", {}, [r.product_name, stdSource[r.id] ? el("span", { class: "dv-tag", text: "기준" }) : null]),
              el("td", { class: "dv-nowrap", text: r.product_code })
            ].concat(fields.map(function (f) {
              var v = r.vals && r.vals[f.id];
              var on = picked[f.id] && picked[f.id].logId === r.id;
              if (v === undefined || v === null || v === "") {
                return el("td", { class: "dv-num dv-empty-val", text: "-" });
              }
              return el("td", { class: "dv-num" }, [el("button", {
                type: "button",
                class: "dv-pick" + (on ? " is-on" : ""),
                title: on ? "선택 해제" : "기준값으로 쓸 값 고르기",
                "aria-pressed": on ? "true" : "false",
                text: valText(v, f),
                onclick: function () {
                  if (on) {
                    delete picked[f.id];
                  } else {
                    picked[f.id] = { logId: r.id, value: v };
                  }
                  renderList();
                }
              })]);
            })).concat([
              el("td", { class: "dv-memo", text: r.memo }),
              el("td", { class: "a-cell-actions dv-noprint" }, [el("div", { class: "a-row" }, [
                el("button", { class: "a-btn a-btn--sm", type: "button", text: "기준값으로", title: "이 기록의 값 전체로 기준값 정하기", onclick: function () {
                  toStandard(r, r.vals || {}, r.id);
                } }),
                el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "복사", title: "같은 조건으로 새 기록 쓰기", onclick: function () {
                  reset();
                  fill(r, true);
                  form.scrollIntoView({ behavior: "smooth", block: "start" });
                  meta.name.focus();
                } }),
                el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "수정", onclick: function () {
                  editingId = r.id;
                  fill(r, false);
                  formTitle.textContent = "기록 수정";
                  submitBtn.textContent = "수정 저장";
                  cancelBtn.hidden = false;
                  form.scrollIntoView({ behavior: "smooth", block: "start" });
                } }),
                el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: async function () {
                  if (!confirm(dotDate(r.log_date) + " " + r.device + " " + (r.product_name || "") + " 기록을 삭제할까요?")) {
                    return;
                  }
                  var res = await sb.from("device_logs").delete().eq("id", r.id);
                  if (res.error) {
                    setMsg(msg, "삭제하지 못했습니다: " + res.error.message, "error");
                    return;
                  }
                  Object.keys(picked).forEach(function (k) {
                    if (picked[k].logId === r.id) {
                      delete picked[k];
                    }
                  });
                  setMsg(msg, "기록을 삭제했습니다.", "ok");
                  refresh();
                } })
              ])])
            ]));
          }) : [el("tr", {}, [el("td", { class: "a-empty", colspan: String(fields.length + 6), text: logs.length ? "조건에 맞는 기록이 없습니다." : "아직 기록이 없습니다. 왼쪽에서 첫 기록을 추가해 보세요." })])])
        ]);

        list.replaceChildren(
          printTitle("장치 기록 데이터", (filter.device || "전체 장치") + " · " + rows.length + "건"),
          el("div", { class: "a-card-head dv-noprint" }, [
            el("h2", { text: "기록 데이터 (" + rows.length + ")" }),
            el("div", { class: "a-row" }, [
              el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "엑셀 저장", onclick: function () {
                exportXlsx("장치기록", ["날짜", "장치", "품명", "코드"].concat(fields.map(fieldHead), ["메모"]), rows.map(function (r) {
                  return [r.log_date, r.device, r.product_name, r.product_code].concat(fields.map(function (f) {
                    return (r.vals && r.vals[f.id]) || "";
                  }), [r.memo]);
                }));
              } }),
              el("button", { class: "a-btn a-btn--sm", type: "button", text: "출력", onclick: function () { window.print(); } })
            ])
          ]),
          filterBar(true, renderList),
          pickBar,
          el("div", { class: "a-table-wrap" }, [table])
        );
      }

      renderList();
      body.replaceChildren(el("div", { class: "panel-grid dv-grid" }, [form, list]));
    }

    function toStandard(row, vals, sourceId) {
      pendingStd = {
        device: row.device || "",
        product_name: row.product_name || "",
        product_code: row.product_code || "",
        vals: Object.assign({}, vals),
        memo: "",
        source_log_id: sourceId || null
      };
      picked = {};
      view = "std";
      saveView(view);
      draw();
    }

    // ---------------- 확정 기준값 ----------------
    function drawStds() {
      var editingId = null;
      var formMsg = el("p", { class: "a-msg", role: "status" });
      var start = pendingStd || {};
      var sourceId = start.source_log_id || null;
      var meta = metaInputs(start);
      var decided = el("input", { type: "date", required: true, value: today() });
      var memo = el("textarea", { rows: "2", maxlength: "2000", placeholder: "선택 사항 · 현장 주의사항 등", value: start.memo || "" });
      var vals = valueInputs(start.vals || {});
      var formTitle = el("h2", { text: pendingStd ? "기준값 확정" : "기준값 직접 입력" });
      var submitBtn = el("button", { class: "a-btn", type: "submit", text: "기준값 저장" });
      var cancelBtn = el("button", { class: "a-btn a-btn--ghost", type: "button", text: "취소", hidden: !pendingStd, onclick: reset });
      pendingStd = null;

      var form = el("form", { class: "a-card dv-noprint" + (start.device ? " is-highlight" : ""), onsubmit: submit }, [
        formTitle,
        el("p", { class: "a-hint", text: "[기록 데이터]에서 값을 고르면 여기로 채워집니다. 값은 고쳐서 저장할 수 있습니다." }),
        el("div", { class: "dv-form-grid" }, [
          el("label", { class: "a-field" }, ["장치", meta.device]),
          el("label", { class: "a-field" }, ["확정일", decided]),
          el("label", { class: "a-field" }, ["품명", meta.name]),
          el("label", { class: "a-field" }, ["코드", meta.code])
        ]),
        el("div", { class: "dv-form-grid" }, vals.nodes),
        el("label", { class: "a-field" }, ["메모", memo]),
        el("div", { class: "a-row" }, [submitBtn, cancelBtn]),
        formMsg
      ]);

      function fill(row) {
        meta.device.value = row.device;
        meta.name.value = row.product_name;
        meta.code.value = row.product_code;
        decided.value = row.decided_at || today();
        memo.value = row.memo || "";
        var fresh = valueInputs(row.vals);
        vals.nodes.forEach(function (n, i) {
          n.replaceWith(fresh.nodes[i]);
        });
        vals = fresh;
      }

      function reset() {
        editingId = null;
        sourceId = null;
        form.classList.remove("is-highlight");
        fill({ device: filter.device || "1호기", product_name: "", product_code: "", memo: "", vals: {} });
        formTitle.textContent = "기준값 직접 입력";
        submitBtn.textContent = "기준값 저장";
        cancelBtn.hidden = true;
      }

      async function submit(e) {
        e.preventDefault();
        var payload = {
          device: meta.device.value.trim(),
          product_name: meta.name.value.trim(),
          product_code: meta.code.value.trim(),
          vals: vals.read(),
          memo: memo.value.trim(),
          decided_at: decided.value,
          updated_at: new Date().toISOString()
        };
        if (!payload.device) {
          setMsg(formMsg, "장치를 입력해 주세요.", "error");
          return;
        }
        if (!payload.product_name && !payload.product_code) {
          setMsg(formMsg, "품명이나 코드 중 하나는 입력해 주세요.", "error");
          return;
        }
        var targetId = editingId;
        if (!targetId) {
          // 같은 장치·품목의 기준값이 이미 있으면 그걸 새 값으로 바꾼다
          var same = stds.find(function (s) {
            return s.device === payload.device &&
              (payload.product_code ? s.product_code === payload.product_code : s.product_name === payload.product_name && !s.product_code);
          });
          if (same) {
            if (!confirm(payload.device + " · " + (payload.product_code || payload.product_name) + " 기준값이 이미 있습니다. 새 값으로 바꿀까요?")) {
              return;
            }
            targetId = same.id;
          }
        }
        if (sourceId) {
          payload.source_log_id = sourceId;
        }
        submitBtn.disabled = true;
        var res = targetId
          ? await sb.from("device_standards").update(payload).eq("id", targetId)
          : await sb.from("device_standards").insert(payload);
        submitBtn.disabled = false;
        if (res.error) {
          setMsg(formMsg, "저장하지 못했습니다: " + res.error.message, "error");
          return;
        }
        setMsg(msg, "기준값을 저장했습니다.", "ok");
        refresh();
      }

      var breakChk = el("input", { type: "checkbox", checked: true });
      var sheet = el("section", { class: "a-card dv-sheet dv-std-sheet is-break" });
      breakChk.addEventListener("change", function () {
        sheet.classList.toggle("is-break", breakChk.checked);
      });

      function renderSheet() {
        var rows = stds.filter(function (r) { return match(r, false); });
        var groups = {};
        rows.forEach(function (r) {
          (groups[r.device] = groups[r.device] || []).push(r);
        });
        var names = Object.keys(groups).sort(byDevice);

        var blocks = names.map(function (dev) {
          return el("div", { class: "dv-std-group" }, [
            printTitle(dev + " 확정 기준값", groups[dev].length + "개 품목"),
            el("h3", { class: "dv-group-title", text: dev }),
            el("div", { class: "a-table-wrap" }, [el("table", { class: "a-table dv-table dv-std-table" }, [
              el("thead", {}, [el("tr", {}, [el("th", { text: "품명" }), el("th", { text: "코드" })].concat(fields.map(function (f) {
                return el("th", { class: "dv-num", text: fieldHead(f) });
              })).concat([el("th", { text: "메모" }), el("th", { text: "확정일" }), el("th", { class: "dv-noprint", text: "" })]))]),
              el("tbody", {}, groups[dev].map(function (r) {
                return el("tr", {}, [
                  el("td", { class: "dv-strong", text: r.product_name }),
                  el("td", { class: "dv-nowrap", text: r.product_code })
                ].concat(fields.map(function (f) {
                  return el("td", { class: "dv-num dv-strong", text: valText(r.vals && r.vals[f.id], f) || "-" });
                })).concat([
                  el("td", { class: "dv-memo", text: r.memo }),
                  el("td", { class: "dv-nowrap", text: dotDate(r.decided_at) }),
                  el("td", { class: "a-cell-actions dv-noprint" }, [el("div", { class: "a-row" }, [
                    el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "수정", onclick: function () {
                      editingId = r.id;
                      sourceId = null;
                      fill(r);
                      formTitle.textContent = "기준값 수정";
                      submitBtn.textContent = "수정 저장";
                      cancelBtn.hidden = false;
                      form.scrollIntoView({ behavior: "smooth", block: "start" });
                    } }),
                    el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: async function () {
                      if (!confirm(r.device + " · " + (r.product_name || r.product_code) + " 기준값을 삭제할까요? (기록 데이터는 남습니다)")) {
                        return;
                      }
                      var res = await sb.from("device_standards").delete().eq("id", r.id);
                      if (res.error) {
                        setMsg(msg, "삭제하지 못했습니다: " + res.error.message, "error");
                        return;
                      }
                      setMsg(msg, "기준값을 삭제했습니다.", "ok");
                      refresh();
                    } })
                  ])])
                ]));
              }))
            ])])
          ]);
        });

        sheet.replaceChildren.apply(sheet, [
          el("div", { class: "a-card-head dv-noprint" }, [
            el("h2", { text: "확정 기준값 (" + rows.length + ")" }),
            el("div", { class: "a-row" }, [
              el("label", { class: "a-check" }, [breakChk, "출력 시 장치별로 페이지 나누기"]),
              el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "엑셀 저장", onclick: function () {
                exportXlsx("확정기준값", ["장치", "품명", "코드"].concat(fields.map(fieldHead), ["메모", "확정일"]), rows.map(function (r) {
                  return [r.device, r.product_name, r.product_code].concat(fields.map(function (f) {
                    return (r.vals && r.vals[f.id]) || "";
                  }), [r.memo, r.decided_at]);
                }));
              } }),
              el("button", { class: "a-btn a-btn--sm", type: "button", text: "현장용 출력", onclick: function () { window.print(); } })
            ])
          ]),
          filterBar(false, renderSheet)
        ].concat(blocks.length ? blocks : [el("p", { class: "a-empty", text: stds.length
          ? "조건에 맞는 기준값이 없습니다."
          : "아직 확정한 기준값이 없습니다. [기록 데이터]에서 값을 골라 기준값으로 정하거나, 왼쪽에서 직접 입력하세요." })]));
      }

      renderSheet();
      body.replaceChildren(el("div", { class: "panel-grid dv-grid" }, [form, sheet]));
      if (start.device) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    // ---------------- 항목 설정 ----------------
    function drawFields() {
      var formMsg = el("p", { class: "a-msg", role: "status" });
      var label = el("input", { type: "text", maxlength: "40", required: true, placeholder: "예: 압력" });
      var unit = el("input", { type: "text", maxlength: "12", placeholder: "예: bar" });
      var form = el("form", { class: "a-card", onsubmit: async function (e) {
        e.preventDefault();
        var max = fields.reduce(function (m, f) { return Math.max(m, f.sort_order); }, 0);
        var res = await sb.from("device_fields").insert({ label: label.value.trim(), unit: unit.value.trim(), sort_order: max + 1 });
        if (res.error) {
          setMsg(formMsg, "추가하지 못했습니다: " + res.error.message, "error");
          return;
        }
        setMsg(msg, "항목을 추가했습니다.", "ok");
        refresh();
      } }, [
        el("h2", { text: "항목 추가" }),
        el("p", { class: "a-hint", text: "추가한 항목은 기록·기준값 입력칸과 표에 바로 생깁니다." }),
        el("label", { class: "a-field" }, ["항목 이름", label]),
        el("label", { class: "a-field" }, ["단위", el("small", { text: "선택 사항 · 숫자 뒤에 붙어 표시됩니다." }), unit]),
        el("div", { class: "a-row" }, [el("button", { class: "a-btn", type: "submit", text: "추가" })]),
        formMsg
      ]);

      async function swap(i, j) {
        var a = fields[i];
        var b = fields[j];
        var r1 = await sb.from("device_fields").update({ sort_order: j + 1 }).eq("id", a.id);
        var r2 = await sb.from("device_fields").update({ sort_order: i + 1 }).eq("id", b.id);
        if (r1.error || r2.error) {
          setMsg(msg, "순서를 바꾸지 못했습니다: " + (r1.error || r2.error).message, "error");
        }
        refresh();
      }

      var list = el("ul", { class: "a-list" }, fields.length ? fields.map(function (f, i) {
        var lab = el("input", { type: "text", maxlength: "40", value: f.label, "aria-label": "항목 이름" });
        var un = el("input", { type: "text", maxlength: "12", value: f.unit, placeholder: "단위", "aria-label": "단위" });
        return el("li", { class: "dv-field-row" }, [
          el("span", { class: "a-cell-no", text: String(i + 1) }),
          lab, un,
          el("div", { class: "a-row" }, [
            el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "↑", title: "위로", disabled: i === 0, onclick: function () { swap(i, i - 1); } }),
            el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "↓", title: "아래로", disabled: i === fields.length - 1, onclick: function () { swap(i, i + 1); } }),
            el("button", { class: "a-btn a-btn--sm", type: "button", text: "저장", onclick: async function () {
              var res = await sb.from("device_fields").update({ label: lab.value.trim() || f.label, unit: un.value.trim() }).eq("id", f.id);
              setMsg(msg, res.error ? "저장하지 못했습니다: " + res.error.message : "항목을 저장했습니다.", res.error ? "error" : "ok");
              refresh();
            } }),
            el("button", { class: "a-btn a-btn--danger a-btn--sm", type: "button", text: "삭제", onclick: async function () {
              if (!confirm("'" + f.label + "' 항목을 삭제할까요? 표에서 이 항목 값이 보이지 않게 됩니다.")) {
                return;
              }
              var res = await sb.from("device_fields").delete().eq("id", f.id);
              setMsg(msg, res.error ? "삭제하지 못했습니다: " + res.error.message : "항목을 삭제했습니다.", res.error ? "error" : "ok");
              refresh();
            } })
          ])
        ]);
      }) : [el("li", { class: "a-empty", text: "항목이 없습니다." })]);

      body.replaceChildren(el("div", { class: "panel-grid" }, [form, el("section", { class: "a-card" }, [
        el("h2", { text: "기록 항목 (" + fields.length + ")" }),
        el("p", { class: "a-hint", text: "장치·날짜·품명·코드·메모는 기본으로 있고, 그 외 측정값 항목을 여기서 관리합니다." }),
        list
      ])]));
    }

    body.replaceChildren(el("p", { class: "a-empty", text: "불러오는 중..." }));
    if (await loadAll()) {
      draw();
    }
  };
})();
