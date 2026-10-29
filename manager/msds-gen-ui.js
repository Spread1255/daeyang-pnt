// 관리자 'MSDS 생성' 탭: 작업지시서 → KOSHA 양식 엑셀 + PDF
// 작업지시서(원료단가표 포함)는 브라우저 안에서만 읽고 서버로 보내지 않는다.
// 서버(Supabase)에는 원료 사전(msds_materials)과 관리자가 추가한 성분(msds_substances)만 둔다. 둘 다 관리자만 읽고 쓴다.
// 기본 성분 자료(msds-substances.json)는 KOSHA 공개 자료에서 뽑은 것이다.
(function () {
  var G = window.DY_MSDS_GEN;

  window.DY_MSDS_GEN_UI = async function (main, ctx) {
    var sb = ctx.sb, el = ctx.el;
    var mats = {}, subs = {}, template = null;
    var wo = [], cur = 0, bases = {}, rangeEdit = {}, prep = null;
    var msg = el("p", { class: "a-msg", role: "status" });
    function setMsg(t, kind) { msg.textContent = t; msg.className = "a-msg" + (kind ? " is-" + kind : ""); }

    var picker = el("input", { type: "file", accept: ".xls,.xlsx" });
    var sheetSel = el("select", {});
    var codeIn = el("input", { type: "text", maxlength: "40" });
    var nameIn = el("input", { type: "text", maxlength: "120" });
    var noIn = el("input", { type: "text", maxlength: "30", placeholder: "예: 174 또는 AA14944-0000000174" });
    var noNote = el("small", { text: "" });
    var carcSel = el("select", {}, [
      el("option", { value: "auto", text: "자동" }), el("option", { value: "2", text: "발암성 구분2" }),
      el("option", { value: "1A", text: "발암성 구분1A" }), el("option", { value: "none", text: "발암성 없음" })
    ]);
    var carcNote = el("small", { text: "" });
    var unknownBox = el("div", {});
    var baseNote = el("p", { class: "a-list-meta", text: "" });
    var compBody = el("tbody");
    var exclNote = el("p", { class: "a-list-meta", text: "" });
    var warnNote = el("p", { class: "a-list-meta", text: "" });
    var genBtn = el("button", { class: "a-btn", type: "button", text: "엑셀·PDF 만들기", disabled: true, onclick: onGenerate });
    var casList = el("datalist", { id: "msds-gen-cas" });
    var infoCard = el("section", { class: "a-card", hidden: true }, [
      el("h2", { text: "2. 제품 정보" }),
      el("label", { class: "a-field" }, ["작업지시서 시트", el("small", { text: "맨 앞 시트가 최신입니다." }), sheetSel]),
      el("label", { class: "a-field" }, ["제품코드", codeIn]),
      el("label", { class: "a-field" }, ["제품명", el("small", { text: "내장형/외장형으로 시작하게 적어 주세요. 권고 용도가 이것으로 정해집니다." }), nameIn]),
      el("label", { class: "a-field" }, ["MSDS 번호", noNote, noIn]),
      el("label", { class: "a-field" }, ["2번 발암성", carcNote, carcSel])
    ]);
    var compCard = el("section", { class: "a-card", hidden: true }, [
      el("h2", { text: "3. 구성성분 확인" }),
      unknownBox, baseNote,
      el("div", { class: "a-table-wrap" }, [el("table", { class: "a-table" }, [
        el("thead", {}, [el("tr", {}, [el("th", { text: "원료" }), el("th", { text: "물질명" }), el("th", { text: "CAS" }), el("th", { text: "값(%)" }), el("th", { text: "함유량 범위" })])]),
        compBody
      ])]),
      exclNote, warnNote,
      el("div", { class: "a-row" }, [genBtn]),
      msg
    ]);

    main.replaceChildren.apply(main, ctx.header("MSDS 생성", "작업지시서를 올리면 KOSHA 양식 엑셀과 PDF를 만듭니다. 작업지시서는 서버로 보내지 않고 이 브라우저 안에서만 읽습니다.").concat([
      casList,
      el("section", { class: "a-card" }, [
        el("h2", { text: "1. 작업지시서 올리기" }),
        el("label", { class: "a-field" }, ["작업지시서 (.xls, .xlsx)", picker]),
        el("p", { class: "a-list-meta", text: "규칙: 작업지시서 NO 순서, DFA·0.01% 미만 제외, 같은 CAS는 합침, 101A·S-160 가루 제외, 골드 분말은 구리:아연 9:1. 함유량 범위는 수지 정수 ±2, 그 밖은 범위 기준표를 따릅니다." })
      ]),
      infoCard, compCard
    ]));

    // ---------- 자료 불러오기 ----------
    try {
      var r1 = await sb.from("msds_materials").select("key, name, cas");
      var r2 = await sb.from("msds_substances").select("cas, name, alias, resin, kosha");
      if (r1.error || r2.error) { throw r1.error || r2.error; }
      r1.data.forEach(function (m) { mats[m.key] = m.cas; });
      // 기본 성분 자료(KOSHA에서 뽑은 공개 정보) 위에 관리자가 추가한 성분을 덮어씀
      subs = await (await fetch("msds-substances.json", { cache: "no-cache" })).json();
      r2.data.forEach(function (s) { subs[s.cas] = Object.assign({}, subs[s.cas] || {}, s, { kosha: s.kosha || (subs[s.cas] || {}).kosha || null }); });
      template = new Uint8Array(await (await fetch("msds-template.xlsx", { cache: "no-cache" })).arrayBuffer());
      refreshCasList();
    } catch (e) {
      main.appendChild(el("p", { class: "a-msg is-error", text: "원료 사전을 불러오지 못했습니다: " + (e.message || e) }));
      picker.disabled = true;
      return;
    }
    var usedNos = {};
    var rr = await sb.from("resources").select("msds_no").eq("category", "msds");
    var maxNo = 0;
    (rr.data || []).forEach(function (r) {
      var m = String(r.msds_no || "").match(/(\d{10})$/);
      if (m) { usedNos[+m[1]] = 1; maxNo = Math.max(maxNo, +m[1]); }
    });
    noNote.textContent = maxNo ? "홈페이지에 등록된 가장 큰 번호: " + maxNo + ". 관리대장과 맞춰 직접 입력해 주세요." : "관리대장과 맞춰 직접 입력해 주세요.";

    function refreshCasList() {
      casList.replaceChildren.apply(casList, Object.keys(subs).sort().map(function (c) {
        return el("option", { value: c, text: c + " " + (subs[c].name || "") });
      }));
    }

    // ---------- 작업지시서 ----------
    picker.addEventListener("change", async function () {
      var f = picker.files[0];
      if (!f) { return; }
      try {
        wo = G.readWorkOrder(new Uint8Array(await f.arrayBuffer()), XLSX);
      } catch (e) { wo = []; }
      if (!wo.length) { setMsg("작업지시서 양식을 읽지 못했습니다. C2에 제품코드(DY#…)가 있는 시트가 필요합니다.", "error"); compCard.hidden = false; return; }
      noIn.value = ""; checkNo();
      sheetSel.replaceChildren.apply(sheetSel, wo.map(function (s, i) { return el("option", { value: String(i), text: s.sheet + " · " + s.name }); }));
      selectSheet(0);
    });
    sheetSel.addEventListener("change", function () { selectSheet(+sheetSel.value); });
    function selectSheet(i) {
      cur = i; bases = {}; rangeEdit = {};
      codeIn.value = wo[i].code; nameIn.value = wo[i].name;
      // 제품명에 내장형/외장형이 없으면 코드로 채움 (DY#1 내장형, DY#2 외장형). 그 밖의 코드는 직접 입력
      if (!/^(내장형|외장형)/.test(nameIn.value)) {
        var io = /^DY#1-/.test(wo[i].code) ? "내장형 " : /^DY#2-/.test(wo[i].code) ? "외장형 " : "";
        nameIn.value = io + nameIn.value;
      }
      infoCard.hidden = false; compCard.hidden = false; setMsg("");
      recompute();
    }
    nameIn.addEventListener("input", recompute);
    carcSel.addEventListener("change", recompute);
    noIn.addEventListener("input", checkNo);

    function fixNo(v) {
      v = String(v || "").trim();
      if (/^\d{1,10}$/.test(v)) { return "AA14944-" + ("0000000000" + v).slice(-10); }
      return v.toUpperCase();
    }
    function checkNo() {
      var v = fixNo(noIn.value), m = v.match(/^AA14944-(\d{10})$/);
      if (!noIn.value.trim()) { noIn.setCustomValidity(""); return null; }
      if (!m) { noIn.setCustomValidity("AA14944-0000000000 형식"); return null; }
      noIn.setCustomValidity("");
      return v;
    }

    // ---------- 구성성분 ----------
    function recompute() {
      var items = wo[cur].items;
      prep = G.prepare(items, mats, { bases: bases, name: nameIn.value });
      renderUnknown(items);
      baseNote.textContent = Object.keys(bases).length ? "베이스로 풀어 넣은 원료: " + Object.keys(bases).map(function (i) {
        return items[i].raw + " " + items[i].val + "% (베이스 원료 " + bases[i].length + "개)";
      }).join(", ") + (/POWDER/i.test(JSON.stringify(Object.keys(bases).map(function (i) { return items[i].raw; }))) && nameIn.value.indexOf("유광") >= 0 ? " · 유광이라 S#3000→S#7000, CT-0230 제외" : "") : "";
      compBody.replaceChildren();
      prep.rows.forEach(function (c) {
        var s = subs[c.cas] || {};
        var auto = prep.rangeOverride[c.cas] || G.rngItem(s, c.val);
        var inp = el("input", { type: "text", value: rangeEdit[c.cas] || auto });
        inp.addEventListener("input", function () { if (inp.value.trim() && inp.value.trim() !== auto) { rangeEdit[c.cas] = inp.value.trim(); } else { delete rangeEdit[c.cas]; } });
        compBody.appendChild(el("tr", {}, [
          el("td", { text: c.raws.filter(function (x, i) { return c.raws.indexOf(x) === i; }).join(", ") }), el("td", { text: s.name || "(물질명 없음)" }), el("td", { text: c.cas }),
          el("td", { text: String(c.val) }), el("td", {}, [inp])
        ]));
      });
      exclNote.textContent = prep.excluded.length ? "0.01% 미만으로 뺀 원료: " + prep.excluded.map(function (x) { return x[0] + " " + x[1]; }).join(", ") : "";
      var noK = prep.rows.filter(function (c) { return !(subs[c.cas] && subs[c.cas].kosha); }).map(function (c) { return c.raws[0] + "(" + c.cas + ")"; });
      warnNote.textContent = noK.length ? "KOSHA 자료가 없는 성분: " + noK.join(", ") + " — 8·11·12·15번에 이 성분 행은 들어가지 않습니다." : "";
      var ac = G.autoCarc(prep.rows);
      carcNote.textContent = "자동 판정: " + (ac === "1A" ? "구분1A (YELLOW P210 함유)" : ac === "2" ? "구분2 (이산화티타늄 함유)" : "없음 (이산화티타늄 없음)");
      genBtn.disabled = prep.unknown.length > 0 || !prep.rows.length;
      if (prep.unknown.length) { setMsg("CAS를 모르는 원료가 있습니다. 위에서 입력해 주세요."); } else if (msg.textContent.indexOf("CAS를 모르는") === 0) { setMsg(""); }
    }

    function renderUnknown(items) {
      unknownBox.replaceChildren();
      if (!prep.unknown.length) { return; }
      unknownBox.appendChild(el("h3", { text: "CAS 파일에 없는 원료" }));
      prep.unknown.forEach(function (raw) {
        var idx = -1;
        items.forEach(function (it, i) { if (it.raw === raw && idx < 0) { idx = i; } });
        var cas = el("input", { type: "text", list: "msds-gen-cas", placeholder: "CAS 번호 (예: 25036-25-3)" });
        var nm = el("input", { type: "text", placeholder: "물질명 (예: 에폭시 수지)" });
        var al = el("input", { type: "text", placeholder: "이명(관용명) — 선택" });
        var resin = el("input", { type: "checkbox" });
        var newSub = el("div", { hidden: true }, [nm, al, el("label", {}, [resin, " 수지 (1% 이상이면 정수 ±2)"])]);
        cas.addEventListener("input", function () { newSub.hidden = !cas.value.trim() || !!subs[cas.value.trim()]; });
        var save = el("button", { class: "a-btn a-btn--sm", type: "button", text: "원료 사전에 저장" });
        var baseIn = el("input", { type: "file", accept: ".xls,.xlsx" });
        var note = el("small", { text: "" });
        save.addEventListener("click", async function () {
          var c = cas.value.trim();
          if (!/^\d{2,7}-\d{2}-\d$/.test(c)) { note.textContent = "CAS 번호 형식이 아닙니다."; return; }
          if (!subs[c] && !nm.value.trim()) { note.textContent = "새 CAS라서 물질명이 필요합니다."; return; }
          save.disabled = true;
          if (!subs[c]) {
            var s = { cas: c, name: nm.value.trim(), alias: al.value.trim() || null, resin: resin.checked, kosha: null };
            var e1 = await sb.from("msds_substances").upsert(s);
            if (e1.error) { note.textContent = "저장 실패: " + e1.error.message; save.disabled = false; return; }
            subs[c] = s; refreshCasList();
          }
          var e2 = await sb.from("msds_materials").upsert({ key: G.nkey(raw), name: raw, cas: c, updated_at: new Date().toISOString() });
          if (e2.error) { note.textContent = "저장 실패: " + e2.error.message; save.disabled = false; return; }
          mats[G.nkey(raw)] = c;
          recompute();
        });
        baseIn.addEventListener("change", async function () {
          var f = baseIn.files[0];
          if (!f) { return; }
          var b = G.readWorkOrder(new Uint8Array(await f.arrayBuffer()), XLSX);
          if (!b.length || !b[0].items.length) { note.textContent = "베이스 작업지시서를 읽지 못했습니다."; return; }
          bases[idx] = b[0].items;
          recompute();
        });
        unknownBox.appendChild(el("div", { class: "a-card a-card--gap" }, [
          el("strong", { text: raw }),
          el("p", { class: "a-list-meta", text: "CAS를 입력해 원료 사전에 저장하면 다음부터 자동으로 쓰입니다. 이름만 새것이고 같은 원료면 그 원료의 CAS를 입력하세요." }),
          el("div", { class: "a-row" }, [cas, save]), newSub,
          idx >= 0 ? el("p", { class: "a-list-meta" }, ["POWDER·함마톤 베이스처럼 다른 작업지시서 배합이면 그 작업지시서를 올리세요 (이번 생성에만 쓰고 저장하지 않음): ", baseIn]) : null,
          note
        ]));
      });
    }

    // ---------- 만들기 ----------
    function download(bytes, type, name) {
      var a = el("a", { href: URL.createObjectURL(new Blob([bytes], { type: type })), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }
    async function onGenerate() {
      var no = checkNo();
      if (!no) { setMsg("MSDS 번호를 입력해 주세요 (예: 174).", "error"); noIn.focus(); return; }
      if (!/^(내장형|외장형)/.test(nameIn.value.trim())) { setMsg("제품명은 내장형 또는 외장형으로 시작해야 합니다.", "error"); return; }
      if (usedNos[+no.slice(-10)] && !confirm("홈페이지에 이미 " + no + " 번호의 MSDS가 있습니다. 그래도 만들까요?")) { return; }
      genBtn.disabled = true; setMsg("만드는 중입니다...");
      try {
        var over = Object.assign({}, prep.rangeOverride, rangeEdit);
        var p = { code: codeIn.value.trim(), name: nameIn.value.trim(), no: no, rows: prep.rows, carc: carcSel.value, rangeOverride: over };
        var res = await G.generate(template, p, subs, JSZip);
        var base = G.fileBase(p.code, p.name);
        download(res.bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base + ".xlsx");
        var model = DY_MSDS_FRM.parse(res.bytes, XLSX);
        var pdf = await DY_MSDS_FRM.toPdf(model, { name: p.name, code: p.code, msdsNo: no });
        download(pdf, "application/pdf", base + ".pdf");
        setMsg("만들었습니다: " + base + " (엑셀·PDF). 발암성: " + (res.report.carc ? "구분" + res.report.carc : "없음") + ". MSDS 탭에서 홈페이지에 등록할 수 있습니다.", "ok");
      } catch (e) {
        setMsg("만들지 못했습니다: " + (e.message || e), "error");
      }
      genBtn.disabled = false;
    }
  };
})();
