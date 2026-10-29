/*
  MSDS 생성기: 작업지시서 원료 → KOSHA 양식 엑셀(msds-template.xlsx 틀)
  ------------------------------------------------------------
  - 작업지시서·원료 정보는 브라우저 안에서만 처리하고 서버로 보내지 않는다.
  - 틀(IV064 KOSHA 양식)의 행을 넣고 빼면서 병합·행 높이·페이지 나누기·그림 위치를 함께 옮긴다.
  - 규칙은 msds-source/data/MSDS 함유량 범위 기준.md 와 같다.
  사용: DY_MSDS_GEN.readWorkOrder(bytes, XLSX) → DY_MSDS_GEN.prepare(...) → DY_MSDS_GEN.build(...)
*/
(function (root) {
  "use strict";

  // ---------------- 공통 ----------------
  function norm(v) { return String(v == null ? "" : v).trim().replace(/\s+/g, " "); }
  // 원료명 비교용 키: 대문자, 공백·# 제거, 끝의 (IN) 제거
  function nkey(n) { return String(n == null ? "" : n).trim().toUpperCase().replace(/\(IN\)$/, "").replace(/[\s#]/g, ""); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function unesc(s) {
    return String(s).replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(+d); })
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }
  function attrs(s) {
    var o = {}, re = /([\w:]+)="([^"]*)"/g, m;
    while ((m = re.exec(s))) { o[m[1]] = m[2]; }
    return o;
  }
  function colNum(L) { return L.charCodeAt(0) - 64; }
  function colLetter(n) { return String.fromCharCode(64 + n); }
  function serial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); }

  // ---------------- 함유량 범위 ----------------
  function decimals(v) {
    var s = String(v);
    if (/e/i.test(s)) { s = v.toFixed(12); }
    var i = s.indexOf(".");
    return i < 0 ? 0 : s.slice(i + 1).replace(/0+$/, "").length;
  }
  // 50 이상 ±2, 1~50 ±1, 0.1~1 ±0.1, 0.01~0.1 ±0.01 (가운데값은 단위로 반올림, 0.5는 내림)
  // 1 미만 소수 셋째 자리 이상은 둘째 자리까지 버리고 ±0.01, 하한은 단위 1칸 아래로 내려가지 않음
  function rng(v) {
    var st;
    if (decimals(v) >= 3 && v < 1) { v = Math.floor(v * 100 + 1e-9) / 100; st = 0.01; }
    else { st = v >= 50 ? 2 : v >= 1 ? 1 : v >= 0.1 ? 0.1 : 0.01; }
    var u = st === 2 ? 1 : st;
    var c = Math.ceil(Math.round((v / u - 0.5) * 1e9) / 1e9) * u;
    var lo = Math.max(c - st, u), hi = c + st;
    var dp = u >= 1 ? 0 : (u === 0.1 ? 1 : 2);
    return lo.toFixed(dp) + " ∽ " + hi.toFixed(dp);
  }
  // 수지(1% 이상): 소수점 이하 버린 정수 ±2
  function rngItem(sub, v) {
    if (sub && sub.resin && v >= 1) { var c = Math.floor(v + 1e-9); return Math.max(c - 2, 1) + " ∽ " + (c + 2); }
    return rng(v);
  }
  // 골드 브론즈 유래 구리·아연: 소수 첫째 자리 버림 ±0.1
  function rngBronze(v) { var t = Math.floor(v * 10 + 1e-9) / 10; return Math.max(t - 0.1, 0.1).toFixed(1) + " ∽ " + (t + 0.1).toFixed(1); }

  // ---------------- 작업지시서 읽기 ----------------
  // 시트: '원료단가표' 제외, 첫 시트가 최신. C2 코드, C3 제품명, 8~27행: NO / 원료명 / 백분율(D)
  function readWorkOrder(bytes, XLSX) {
    var wb = XLSX.read(bytes, { type: "array" });
    var sheets = wb.SheetNames.filter(function (n) { return n.indexOf("단가") < 0; });
    return sheets.map(function (sn) {
      var ws = wb.Sheets[sn];
      var g = function (a) { var c = ws[a]; return c ? c.v : null; };
      var items = [];
      for (var r = 8; r <= 27; r++) {
        var no = g("A" + r), raw = g("B" + r), val = g("D" + r);
        if (raw == null || norm(raw) === "" || typeof val !== "number") { continue; }
        if (/합\s*계/.test(String(no || ""))) { break; }
        items.push({ no: no == null ? "" : String(no).trim(), raw: norm(raw), val: val });
      }
      return { sheet: sn, code: norm(g("C2")), name: norm(g("C3")), items: items };
    }).filter(function (s) { return /^DY/.test(s.code); });
  }

  // ---------------- 원료 정리 ----------------
  var DFA = { "CERA-994": 1, "HDKV15": 1 };
  var SKIP = /^(101A|S-160)/;                 // 함마톤 가루(101A, S-160)는 넣지 않음
  var BRONZE = { "RICHGOLD": 1, "PALEGOLD": 1 }; // 골드 브론즈 = 구리:아연 9:1
  var CU = "7440-50-8", ZN = "7440-66-6";

  function isDfa(it) { return it.no === "DFA" || DFA[nkey(it.raw)]; }

  /* items: 작업지시서 원료, materials: {nkey: cas}, bases: {행 index: 베이스 원료 목록}
     반환: { rows:[{cas, raws, val}], unknown:[원료명], excluded:[[원료명,값]], expanded:bool, rangeOverride:{cas:범위} } */
  function prepare(items, materials, opt) {
    opt = opt || {};
    var bases = opt.bases || {}, name = opt.name || "";
    var flat = [], expanded = false, over = {};
    items.forEach(function (it, i) {
      if (isDfa(it) || SKIP.test(nkey(it.raw))) { return; }
      if (bases[i]) {                          // POWDER·함마톤 베이스: 베이스 배합을 % 비례로 풀어 넣음
        var powder = nkey(it.raw) === "POWDER";
        expanded = true;
        bases[i].forEach(function (b) {
          if (isDfa(b)) { return; }
          var raw = b.raw;
          if (powder && name.indexOf("유광") >= 0) {   // 유광: S#3000 → S#7000, CT-0230 삭제
            if (nkey(raw) === "CT-0230") { return; }
            if (nkey(raw) === "S3000") { raw = "S#7000"; }
          }
          flat.push({ raw: raw, val: Math.round(it.val * b.val) / 100 });
        });
        return;
      }
      if (BRONZE[nkey(it.raw)]) {
        flat.push({ raw: it.raw + " (Cu)", val: Math.round(it.val * 0.9 * 1e4) / 1e4, cas: CU, bronze: 1 });
        flat.push({ raw: it.raw + " (Zn)", val: Math.round(it.val * 0.1 * 1e4) / 1e4, cas: ZN, bronze: 1 });
        return;
      }
      flat.push({ raw: it.raw, val: it.val });
    });
    var out = { rows: [], unknown: [], excluded: [], expanded: expanded, rangeOverride: over };
    var bronzeSum = {};
    flat.forEach(function (it) {
      var cas = it.cas || materials[nkey(it.raw)];
      if (!cas) { if (out.unknown.indexOf(it.raw) < 0) { out.unknown.push(it.raw); } return; }
      if (it.bronze) { bronzeSum[cas] = (bronzeSum[cas] || 0) + it.val; }
      if (!(it.val >= 0.01)) { out.excluded.push([it.raw, it.val]); return; }
      var hit = out.rows.filter(function (c) { return c.cas === cas; })[0];
      if (hit) { hit.raws.push(it.raw); hit.val = Math.round((hit.val + it.val) * (expanded ? 100 : 1e6)) / (expanded ? 100 : 1e6); }
      else { out.rows.push({ cas: cas, raws: [it.raw], val: it.val }); }
    });
    Object.keys(bronzeSum).forEach(function (cas) { over[cas] = rngBronze(bronzeSum[cas]); });
    return out;
  }

  // ---------------- 엑셀 틀 (시트 XML 직접 편집) ----------------
  function Book(files) {
    var sx = files["xl/worksheets/sheet1.xml"];
    this.files = files;
    var sst = [];
    (files["xl/sharedStrings.xml"] || "").replace(/<si>([\s\S]*?)<\/si>/g, function (m, b) {
      var t = ""; b.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, function (m2, x) { t += unesc(x); }); sst.push(t);
    });
    // 섹션 제목 행(배경 E6E6FA) 판별용 스타일
    var st = files["xl/styles.xml"], fills = [], hdr = {};
    (st.match(/<fills[^>]*>([\s\S]*?)<\/fills>/)[1].match(/<fill>[\s\S]*?<\/fill>|<fill\/>/g) || []).forEach(function (f) {
      fills.push(/fgColor rgb="..E6E6FA"/i.test(f));
    });
    (st.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].match(/<xf [^>]*>/g) || []).forEach(function (x, i) {
      if (fills[+attrs(x).fillId]) { hdr[i] = 1; }
    });
    this.hdr = hdr;
    var i0 = sx.indexOf("<sheetData>"), i1 = sx.indexOf("</sheetData>");
    this.head = sx.slice(0, i0); this.tail = sx.slice(i1 + 12);
    var rows = [null];
    sx.slice(i0 + 11, i1).replace(/<row ([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, function (m, a, end, body) {
      var at = attrs(a), r = +at.r; delete at.r; delete at.spans;
      var cells = {};
      (body || "").replace(/<c r="([A-Z]+)\d+"([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g, function (m2, L, ca, e2, cb) {
        var c = attrs(ca), cell = { s: c.s };
        if (cb) {
          if (c.t === "s") { cell.v = sst[+cb.match(/<v>(\d+)<\/v>/)[1]]; }
          else if (c.t === "inlineStr" || c.t === "str") { var t = ""; cb.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, function (m3, x) { t += unesc(x); }); cell.v = t; }
          else { var v = cb.match(/<v>([^<]*)<\/v>/); if (v) { cell.v = +v[1]; } }
        }
        cells[colNum(L)] = cell;
      });
      while (rows.length < r) { rows.push({ at: {}, cells: {} }); }
      rows[r] = { at: at, cells: cells };
    });
    this.rows = rows;
    var mc = (this.tail.match(/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/) || [, ""])[1];
    this.merges = [];
    var self = this;
    mc.replace(/ref="([A-Z])(\d+):([A-Z])(\d+)"/g, function (m, c1, r1, c2, r2) {
      self.merges.push({ c1: colNum(c1), r1: +r1, c2: colNum(c2), r2: +r2 });
    });
    this.brks = [];
    (this.tail.match(/<brk [^>]*>/g) || []).forEach(function (b) { self.brks.push(+attrs(b).id); });
    // 그림: drawing1.xml 의 앵커 (0부터 세는 행 번호)
    var dr = files["xl/drawings/drawing1.xml"], rels = files["xl/drawings/_rels/drawing1.xml.rels"], img = {};
    rels.replace(/Id="(rId\d+)"[^>]*Target="[^"]*\/(image\d+\.png)"/g, function (m, id, f) { img[id] = f; });
    var a0 = dr.indexOf("<xdr:twoCellAnchor");
    this.drHead = dr.slice(0, a0); this.drTail = dr.slice(dr.lastIndexOf("</xdr:twoCellAnchor>") + 20);
    this.anchors = (dr.match(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g) || []).map(function (x) {
      var rr = x.match(/<xdr:row>(\d+)<\/xdr:row>/g).map(function (y) { return +y.replace(/\D/g, ""); });
      return { xml: x, from: rr[0], to: rr[1], img: img[(x.match(/r:embed="(rId\d+)"/) || [])[1]] };
    });
  }
  Book.prototype.maxRow = function () { return this.rows.length - 1; };
  Book.prototype.get = function (r, c) { var row = this.rows[r], cell = row && row.cells[c]; return cell ? cell.v : null; };
  Book.prototype.set = function (r, c, v) {
    var row = this.rows[r]; var cell = row.cells[c] || (row.cells[c] = {});
    cell.v = v == null ? undefined : v;
  };
  Book.prototype.t = function (r, c) { return norm(this.get(r, c)); };
  Book.prototype.secRange = function (n) {
    var re = new RegExp("^" + n + "\\.\\s*"), re2 = new RegExp("^" + (n + 1) + "\\.\\s*"), a = null, k;
    for (k = 1; k <= this.maxRow(); k++) {
      var c = this.rows[k].cells[1];
      if (re.test(this.t(k, 1)) && c && this.hdr[c.s]) { a = k; break; }
    }
    if (a == null) { throw new Error("섹션 " + n + " 없음"); }
    for (k = a + 1; k <= this.maxRow(); k++) { if (re2.test(this.t(k, 1))) { return [a, k]; } }
    return [a, this.maxRow()];
  };
  Book.prototype.rowOf = function (pred, lo, hi) {
    for (var k = lo; k < hi && k <= this.maxRow(); k++) { if (pred(this.t(k, 1))) { return k; } }
    throw new Error("행을 찾을 수 없음");
  };
  Book.prototype.snapRow = function (k) {
    var row = this.rows[k], styles = [];
    for (var c = 1; c <= 5; c++) { styles.push(row.cells[c] ? row.cells[c].s : undefined); }
    return {
      styles: styles,
      merges: this.merges.filter(function (m) { return m.r1 === k && m.r2 === k; }).map(function (m) { return [m.c1, m.c2]; }),
      height: row.at.ht ? +row.at.ht : 20
    };
  };
  // 행 r 부터 n행 이동 (n<0: r ~ r-n-1 삭제). 병합·나누기·그림을 함께 옮김
  Book.prototype._shift = function (at, n) {
    var keep = [];
    this.merges.forEach(function (m) {
      if (n < 0) {
        var d0 = at, d1 = at - n - 1;
        if (m.r2 < d0) { /* 위쪽: 그대로 */ }
        else if (m.r1 > d1) { m.r1 += n; m.r2 += n; }
        else if (m.r1 >= d0 && m.r2 <= d1) { return; }
        else {                                       // 일부만 겹치는 병합은 줄인다
          var lo = m.r1 < d0 ? Math.min(m.r1, d0) : d0;
          var hi = m.r2 > d1 ? m.r2 + n : d0 - 1;
          if (hi < lo || (hi === lo && m.c1 === m.c2)) { return; }
          m = { c1: m.c1, r1: lo, c2: m.c2, r2: hi };
        }
      } else if (m.r1 >= at) { m.r1 += n; m.r2 += n; }
      if (m.r1 === m.r2 && m.c1 === m.c2) { return; }
      keep.push(m);
    });
    this.merges = keep;
    this.brks = this.brks.map(function (b) { return b >= at ? b + n : b; });
    this.anchors.forEach(function (a) {            // 앵커 행은 0부터: 엑셀 행 = 값 + 1
      if (a.from + 1 >= at) { a.from += n; a.to += n; }
    });
  };
  Book.prototype.deleteRow = function (r) { this.rows.splice(r, 1); this._shift(r, -1); };
  var IND = "                 ";
  // items: [[이름, 값], ...] 을 r 행 앞에 끼움. tpl: snapRow 결과 또는 견본 행 번호
  Book.prototype.insertBefore = function (r, items, tpl) {
    var n = items.length; if (n <= 0) { return; }
    var snap = (tpl && typeof tpl === "object") ? tpl : this.snapRow(tpl || r - 1);
    this._shift(r, n);
    var add = [];
    for (var i = 0; i < n; i++) {
      var cells = {};
      for (var c = 1; c <= 5; c++) { if (snap.styles[c - 1] !== undefined) { cells[c] = { s: snap.styles[c - 1] }; } }
      var a = items[i][0], b = items[i][1];
      if (a) { (cells[1] = cells[1] || {}).v = IND + a; }
      if (b != null) { (cells[2] = cells[2] || {}).v = b; }
      add.push({ at: { ht: String(snap.height), customHeight: "true" }, cells: cells });
      var self = this;
      snap.merges.forEach(function (m) { self.merges.push({ c1: m[0], r1: r + i, c2: m[1], r2: r + i }); });
    }
    Array.prototype.splice.apply(this.rows, [r, 0].concat(add));
  };
  Book.prototype.setHeight = function (r, h) { this.rows[r].at.ht = String(h); this.rows[r].at.customHeight = "true"; };
  // 그림문자: 'GHS07','GHS08' 중 쓰는 것만 남김 (틀: image3=GHS07, image2=GHS08)
  Book.prototype.pictograms = function (keep) {
    var map = { "image2.png": "GHS08", "image3.png": "GHS07" };
    this.anchors = this.anchors.filter(function (a) { return !map[a.img] || keep.indexOf(map[a.img]) >= 0; });
  };
  Book.prototype.toFiles = function () {
    var out = [];
    for (var r = 1; r < this.rows.length; r++) {
      var row = this.rows[r], at = row.at, s = '<row r="' + r + '"';
      Object.keys(at).forEach(function (k) { s += " " + k + '="' + esc(at[k]) + '"'; });
      var cs = "";
      Object.keys(row.cells).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
        var cell = row.cells[c], ref = colLetter(c) + r, sa = cell.s !== undefined ? ' s="' + cell.s + '"' : "";
        if (cell.v === undefined || cell.v === null || cell.v === "") { cs += '<c r="' + ref + '"' + sa + "/>"; }
        else if (typeof cell.v === "number") { cs += '<c r="' + ref + '"' + sa + ' t="n"><v>' + cell.v + "</v></c>"; }
        else { cs += '<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + esc(cell.v) + "</t></is></c>"; }
      });
      out.push(cs ? s + ">" + cs + "</row>" : s + "/>");
    }
    var tail = this.tail
      .replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, '<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) {
        return '<mergeCell ref="' + colLetter(m.c1) + m.r1 + ":" + colLetter(m.c2) + m.r2 + '"/>';
      }).join("") + "</mergeCells>")
      .replace(/<rowBreaks[^>]*>[\s\S]*?<\/rowBreaks>/, '<rowBreaks count="' + this.brks.length + '" manualBreakCount="' + this.brks.length + '">' +
        this.brks.map(function (b) { return '<brk id="' + b + '" man="true" max="16383" min="0"/>'; }).join("") + "</rowBreaks>");
    var head = this.head.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:E' + (this.rows.length - 1) + '"/>');
    var files = Object.assign({}, this.files);
    files["xl/worksheets/sheet1.xml"] = head + "<sheetData>" + out.join("") + "</sheetData>" + tail;
    files["xl/drawings/drawing1.xml"] = this.drHead + this.anchors.map(function (a) {
      var k = 0;
      return a.xml.replace(/<xdr:row>\d+<\/xdr:row>/g, function () { return "<xdr:row>" + (k++ === 0 ? a.from : a.to) + "</xdr:row>"; });
    }).join("") + this.drTail;
    return files;
  };

  // ---------------- 2번 유해성·위험성 ----------------
  var SEC2_CLASS = ["급성 독성(경구) : 구분4", "피부 부식성/피부 자극성 : 구분2", "발암성 : 구분2"];
  var SEC2_H = ["H351 암을 일으킬 것으로 의심됨", "H315 피부에 자극을 일으킴", "H302 삼키면 유해함"];
  var SEC2_PREV = ["P201 사용 전 취급 설명서를 확보하시오.", "P202 모든 안전 예방조치 문구를 읽고 이해하기 전에는 취급하지 마시오.",
    "P264 취급 후에는 손을 철저히 씻으시오.", "P270 이 제품을 사용할 때에는 먹거나, 마시거나 흡연하지 마시오.", "P280 보호장갑/보호의/보안경/안면보호구를(을)착용하시오."];
  var SEC2_RESP = ["P301+P312 삼켰다면: 불편함을 느끼면 의료기관/의사의 진찰을 받으시오.", "P302+P352 피부에 묻으면: 다량의 물로 씻으시오.",
    "P308+P313 노출되거나 노출이 우려되면:의학적인 조치/조언을 받으시오.", "P321 적절한 처치를 하시오.", "P330 입을 씻어내시오.",
    "P332+P313 피부 자극이 나타나면: 의학적인 조치/조언을 받으시오.", "P362+P364 오염된 의류를 벗고 다시 사용 전 세척하시오."];
  var CARC_P = { "P201": 1, "P202": 1, "P308+P313": 1, "P405": 1 };  // 발암성에만 붙는 예방조치문구

  // carc: '2' | '1A' | null(이산화티타늄 없음 → 발암성·H351·GHS08 제외)
  function applySec2(B, carc) {
    var ab = B.secRange(2), a = ab[0], b = ab[1];
    if (!B.t(a + 1, 1).startsWith("가.") || a !== 15) { throw new Error("2번 틀 구조가 다름"); }
    var cls = SEC2_CLASS.slice(), hs = SEC2_H.slice(), prev = SEC2_PREV.slice(), resp = SEC2_RESP.slice();
    var store = ["P405 잠금장치를 하여 저장하시오."];
    if (carc === "1A") { cls[2] = "발암성 : 구분1A"; hs[0] = "H350 암을 일으킬 수 있음"; B.set(22, 2, "위험"); }
    if (carc == null) {
      cls = cls.slice(0, 2); hs = hs.slice(1);
      var keep = function (t) { return !CARC_P[t.split(" ")[0]]; };
      prev = prev.filter(keep); resp = resp.filter(keep); store = [];
    }
    function fit(label, nxt, vals) {
      var r = B.rowOf(function (t) { return t === label; }, a, b + 20);
      var e = B.rowOf(function (t) { return t === nxt; }, r + 1, b + 20), n = e - r;
      if (vals.length > n) { B.insertBefore(e, new Array(vals.length - n).fill([null, null])); }
      for (var k = r + n - 1; k > r + Math.max(vals.length, 1) - 1; k--) { B.deleteRow(k); }
      if (!vals.length) { B.deleteRow(r); return; }
      vals.forEach(function (t, i) { B.set(r + i, 2, t); });
    }
    fit("저장", "폐기", store); fit("대응", store.length ? "저장" : "폐기", resp); fit("예방", "대응", prev);
    hs.forEach(function (t, k) { B.set(23 + k, 2, t); });
    for (var k = 23 + hs.length; k < 26; k++) { B.deleteRow(23 + hs.length); }
    cls.forEach(function (t, k) { B.set(16 + k, 2, t); });
    for (k = 16 + cls.length; k < 19; k++) { B.deleteRow(16 + cls.length); }
    B.pictograms(carc == null ? ["GHS07"] : ["GHS07", "GHS08"]);
  }

  // ---------------- 생성 ----------------
  // 틀에 이미 있는 성분 표기 → CAS (없는 성분이면 해당 행 삭제)
  var TLABEL = [["에폭시 수지", "25036-25-3"], ["에폭시수지", "25036-25-3"], ["벤조인", "119-53-9"], ["폴리에틸렌(POLYETHYLENE)", "9002-88-4"],
    ["Barite (Ba(SO4))", "13462-86-7"], ["이산화티타늄", "13463-67-7"], ["C.I. 색소 황색 83(C.I. PIGMENT YELLOW 83)", "5567-15-7"],
    ["Limestone", "1317-65-3"], ["산화철", "1309-37-1"]];
  function tlabel(t) { for (var i = 0; i < TLABEL.length; i++) { if (TLABEL[i][0] === t) { return TLABEL[i][1]; } } return null; }
  var COLOR = { BE: "베이지색", BK: "흑색", BL: "청색", BR: "갈색", GY: "회색", IV: "아이보리색", RD: "적색", WH: "백색", YL: "황색", GD: "금색", GN: "녹색", SI: "은색" };
  var TIO2 = "13463-67-7", P210 = "8007-18-9";
  var LAB11 = ["경구", "경피", "흡입", "피부부식성 또는 자극성", "심한 눈손상 또는 자극성", "피부과민성", "고용노동부고시", "IARC", "OSHA", "ACGIH", "NTP", "EU CLP",
    "생식세포변이원성", "생식독성", "특정 표적장기 독성 (1회 노출)", "특정 표적장기 독성 (반복 노출)"];

  function autoCarc(rows) {
    var has = function (c) { return rows.some(function (r) { return r.cas === c; }); };
    return has(P210) ? "1A" : has(TIO2) ? "2" : null;
  }

  /* files: 틀 xlsx 의 {경로: 문자열} (그림 등 바이너리는 그대로 둠)
     p: { code, name, no(MSDS 번호), rows(prepare 결과), carc('auto'|'2'|'1A'|'none'), rangeOverride:{cas:범위}, firstDate, lastDate }
     subs: {cas: {name, alias, resin, kosha}} */
  function build(files, p, subs) {
    var B = new Book(files);
    var comp = p.rows, rep = { rows: [] };
    var sub = function (cas) { return subs[cas] || null; };
    var ro = p.rangeOverride || {};
    var range = function (c) { return ro[c.cas] || rngItem(sub(c.cas), c.val); };
    var n = comp.length;
    if (n > 12) { B.insertBefore(50, new Array(n - 12).fill([null, null]), 49); }
    else if (n < 12) { for (var r = 49; r > 37 + n; r--) { B.deleteRow(r); } }
    var present = {};
    comp.forEach(function (c, i) {
      var s = sub(c.cas), nm = s && s.name ? [s.name, s.alias || null] : [c.raws[0], null];
      var rr = 38 + i;
      B.set(rr, 1, nm[0]); B.set(rr, 3, nm[1]); B.set(rr, 4, c.cas); B.set(rr, 5, range(c));
      var L = Math.max((nm[0] || "").length, (nm[1] || "").length);
      B.setHeight(rr, L > 90 ? 56.25 : L > 60 ? 45 : (L > 34 ? 33.75 : 24.75));
      present[c.cas] = 1; rep.rows.push([c.raws.join(", "), c.cas, c.val, range(c)]);
    });
    var short = {};
    comp.forEach(function (c) {
      var s = sub(c.cas), nm = s && s.name ? s.name : c.raws[0];
      var tl = TLABEL.filter(function (x) { return x[1] === c.cas && x[0] !== "에폭시수지"; });
      short[c.cas] = tl.length ? tl[0][0] : (nm.length <= 30 ? nm : c.raws[0]);
    });
    // 1·9·16번
    var name = p.name.trim(), code = p.code.trim();
    B.set(3, 2, name); B.set(6, 2, name + " (" + code + ")");
    B.set(8, 2, name.startsWith("내장") ? "에폭시 폴리에스테르계 분체도료 일반용" : "폴리에스테르계 분체도료 일반용");
    B.set(4, 1, String(B.get(4, 1)).replace("AA14944-0000000102", p.no));
    var s9 = B.secRange(9), rc = B.rowOf(function (t) { return t === "색상"; }, s9[0], s9[1]);
    var pre = (code.split("-")[1] || "").slice(0, 2);
    if (COLOR[pre]) { B.set(rc, 2, COLOR[pre]); }
    var s16 = B.secRange(16), r16 = B.rowOf(function (t) { return t.startsWith("나. 최초작성일"); }, s16[0], s16[1]);
    var d1 = p.firstDate || [2024, 5, 9], d2 = p.lastDate || [2026, 1, 6];
    B.set(r16, 3, serial(d1[0], d1[1], d1[2]));
    B.set(B.rowOf(function (t) { return t === "개정횟수"; }, r16, B.maxRow() + 1), 3, "1 회");
    B.set(B.rowOf(function (t) { return t === "최종개정일자"; }, r16, B.maxRow() + 1), 3, serial(d2[0], d2[1], d2[2]));
    // 행 서식 견본
    var SNAP = {};
    [8, 11, 12, 15].forEach(function (sn) {
      var ab = B.secRange(sn);
      for (var k = ab[0]; k < ab[1]; k++) {
        var v = String(B.get(k, 1) || "");
        if (v.startsWith(IND.slice(0, 15)) && B.get(k, 2)) { SNAP[sn] = B.snapRow(k); break; }
      }
    });
    // 없는 성분의 틀 행 삭제 (이어지는 값 행 포함)
    [15, 12, 11, 8].forEach(function (sn) {
      var ab = B.secRange(sn), dels = [];
      for (var k = ab[0]; k < ab[1]; k++) {
        var cas = tlabel(B.t(k, 1));
        if (cas && !present[cas]) {
          dels.push(k);
          for (var j = k + 1; j < ab[1] && !B.t(j, 1) && B.get(j, 2); j++) { dels.push(j); }
        }
      }
      dels.filter(function (x, i) { return dels.indexOf(x) === i; }).sort(function (a, b) { return b - a; }).forEach(function (k) { B.deleteRow(k); });
    });
    // 틀에 없는 성분 행 추가 (KOSHA 자료)
    function hasChild(lo, hi, cas) {
      for (var k = lo; k < hi; k++) { if (tlabel(B.t(k, 1)) === cas) { return true; } }
      return false;
    }
    function block(label, lo, hi, stop) {
      var s = B.rowOf(function (t) { return t === label; }, lo, hi), e = s + 1;
      while (e < hi && !stop(B.t(e, 1))) { e++; }
      return [s, e];
    }
    var K = function (cas) { var s = sub(cas); return (s && s.kosha) || null; };
    var OPS = [];
    var a8 = B.secRange(8);
    [["국내규정", "ACGIH 규정", "exp_kr"], ["ACGIH 규정", "나. 적절한 공학적 관리", "exp_acgih"]].forEach(function (x) {
      var se = block(x[0], a8[0], a8[1], function (t) { return t === x[1]; }), items = [];
      comp.forEach(function (c) {
        if (hasChild(se[0] + 1, se[1], c.cas)) { return; }
        ((K(c.cas) || {})[x[2]] || []).forEach(function (v) { items.push([short[c.cas], v]); });
      });
      if (items.length) { OPS.push([se[1], items, se[0]]); }
    });
    var a11 = B.secRange(11);
    var isl = function (t) { return /^(-|\*|나\.|다\.|라\.|마\.)/.test(t); };
    LAB11.forEach(function (kl) {
      var se = block("- " + kl, a11[0], a11[1], isl), items = [];
      comp.forEach(function (c) {
        if (hasChild(se[0] + 1, se[1], c.cas)) { return; }
        var t = ((K(c.cas) || {}).tox || {})[kl];
        if (t) { items.push([short[c.cas], t]); }
      });
      if (items.length) {
        var ins = se[1];   // 들여쓰기가 다른 마지막 행(예: 황색 83) 앞에 끼움
        while (ins - 1 > se[0]) {
          var v = String(B.get(ins - 1, 1) || "");
          if (v.length - v.replace(/^\s+/, "").length < 15 && B.t(ins - 1, 1)) { ins--; } else { break; }
        }
        OPS.push([ins > se[0] ? ins : se[1], items, se[0]]);
      }
    });
    var a12 = B.secRange(12);
    ["어류", "갑각류", "조류", "잔류성"].forEach(function (kl) {
      var se = block("- " + kl, a12[0], a12[1], isl), items = [];
      comp.forEach(function (c) {
        var t = ((K(c.cas) || {}).eco || {})[kl];
        if (!hasChild(se[0] + 1, se[1], c.cas) && t) { items.push([short[c.cas], t]); }
      });
      if (items.length) { OPS.push([se[1], items, se[0]]); }
    });
    var a15 = B.secRange(15);
    var se = block("가. 산업안전보건법에 의한 규제", a15[0], a15[1], function (t) { return t.startsWith("나."); }), items = [];
    comp.forEach(function (c) {
      if (hasChild(se[0] + 1, se[1], c.cas)) { return; }
      ((K(c.cas) || {}).osh || []).forEach(function (x, i) { items.push([i === 0 ? short[c.cas] : null, x]); });
    });
    if (items.length) { OPS.push([se[1], items, se[0]]); }
    se = block("라. 위험물안전관리법에 의한 규제", a15[0], a15[1], function (t) { return t.startsWith("바."); });
    items = comp.filter(function (c) { return !hasChild(se[0] + 1, se[1], c.cas) && (K(c.cas) || {}).waste; })
      .map(function (c) { return [short[c.cas], "지정폐기물"]; });
    if (items.length) { OPS.push([se[1], items, se[0]]); }
    function secOf(r) {
      var ns = [8, 11, 12, 15];
      for (var i = 0; i < ns.length; i++) { var x = B.secRange(ns[i]); if (x[0] <= r && r < x[1]) { return ns[i]; } }
    }
    OPS.sort(function (x, y) { return y[0] - x[0]; }).forEach(function (o) {
      if (B.t(o[2], 2) === "자료없음") { B.set(o[2], 2, null); }
      B.insertBefore(o[0], o[1], SNAP[secOf(o[2])]);
    });
    // 비어 버린 항목은 '자료없음'
    [8, 11, 12, 15].forEach(function (sn) {
      var ab = B.secRange(sn);
      for (var k = ab[0] + 1; k < ab[1]; k++) {
        var t = B.t(k, 1);
        if ((t.startsWith("-") || t === "국내규정" || t === "ACGIH 규정") && !B.get(k, 2)) {
          var nx = k + 1 < ab[1] ? B.t(k + 1, 1) : "-";
          var child = k + 1 < ab[1] && B.get(k + 1, 2) && !(/^(-|\*)/.test(nx) || nx === "ACGIH 규정" || /^[가-하]\./.test(nx));
          if (!child) { B.set(k, 2, "자료없음"); }
        }
      }
    });
    var carc = p.carc === "auto" || p.carc === undefined ? autoCarc(comp) : (p.carc === "none" ? null : p.carc);
    applySec2(B, carc);
    rep.carc = carc;
    return { files: B.toFiles(), report: rep };
  }

  // 파일명: '코드 제품명(내장형/외장형 제외) MSDS' ('/'는 '-')
  function fileBase(code, name) {
    return (code + " " + String(name).replace(/^\s*(내장형|외장형)\s*/, "") + " MSDS").replace(/\//g, "-").replace(/[\\:*?"<>|]+/g, "_");
  }

  // 틀 xlsx(바이트) → 생성한 xlsx(Uint8Array)
  var TEXT_PARTS = ["xl/worksheets/sheet1.xml", "xl/sharedStrings.xml", "xl/styles.xml", "xl/drawings/drawing1.xml", "xl/drawings/_rels/drawing1.xml.rels"];
  async function generate(templateBytes, p, subs, JSZip) {
    var zip = await JSZip.loadAsync(templateBytes), files = {};
    for (var i = 0; i < TEXT_PARTS.length; i++) {
      var f = zip.file(TEXT_PARTS[i]);
      if (f) { files[TEXT_PARTS[i]] = await f.async("string"); }
    }
    var res = build(files, p, subs);
    zip.file("xl/worksheets/sheet1.xml", res.files["xl/worksheets/sheet1.xml"]);
    zip.file("xl/drawings/drawing1.xml", res.files["xl/drawings/drawing1.xml"]);
    var bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return { bytes: bytes, report: res.report };
  }

  root.DY_MSDS_GEN = {
    nkey: nkey, rng: rng, rngItem: rngItem, readWorkOrder: readWorkOrder, prepare: prepare, build: build, generate: generate,
    autoCarc: autoCarc, fileBase: fileBase, Book: Book
  };
})(typeof window !== "undefined" ? window : globalThis);
