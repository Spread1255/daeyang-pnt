// 원본 엑셀 MSDS(KOSHA 양식)를 FRM 서식(파란 제목 띠·번호 섹션·○ 항목·점선 표·바닥글) A4 PDF로 다시 만든다.
// window.DY_MSDS_FRM.parse(bytes, XLSX)            → 내용 모델
// window.DY_MSDS_FRM.toPdf(model, meta)            → Promise<Blob>  (meta: { name, code, msdsNo })
//
// 원본 엑셀 구조 (대양피앤티 MSDS 엑셀 공통):
//  - A열: 항목 이름. 앞 공백 수가 단계(2~3칸 = "가." 소제목, 8칸 = ○ 항목, 12칸 이상 = 하위 항목)
//  - B열(B~E 병합): 값. A열이 빈 줄은 위 항목의 값이 이어지는 것
//  - 연보라(E6E6FA) 칸: "1. …" 섹션 제목, 3번 섹션의 회색(E8E8E8) 줄: 구성성분 표 머리(A·C·D·E열)
//  - 그림문자 그림은 엑셀에서 읽을 수 없어 H코드로 GHS 그림문자를 정한다
(function (root) {
  // ---------- 읽기 ----------
  var SUB_RE = /^([가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허])\s*\.\s*(.*)$/;
  var SEC_RE = /^(\d{1,2})\s*\.\s*(.+)$/;
  // 원본에 자주 있는 오타 바로잡기 (표준 문구 기준)
  var FIXES = [["피부에 저극을 일으킴", "피부에 자극을 일으킴"]];

  function fix(text) {
    FIXES.forEach(function (f) {
      text = text.split(f[0]).join(f[1]);
    });
    return text;
  }

  function cellText(ws, XLSX, r, c) {
    var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    if (!cell || cell.v === undefined || cell.v === null) {
      return "";
    }
    var t = cell.v instanceof Date ? XLSX.SSF.format("yyyy-mm-dd", cell.v) : String(cell.w !== undefined ? cell.w : cell.v);
    return fix(t.replace(/\r/g, ""));
  }

  function cellFill(ws, XLSX, r, c) {
    var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    return (cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb || "").toUpperCase();
  }

  function splitLines(text) {
    return String(text).split("\n").map(function (s) { return s.replace(/\s+/g, " ").trim(); }).filter(Boolean);
  }

  function parse(bytes, XLSX) {
    var wb = XLSX.read(bytes, { type: "array", cellStyles: true, cellDates: true, dateNF: "yyyy-mm-dd" });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var range = XLSX.utils.decode_range(ws["!ref"]);
    var model = { name: "", msdsNo: "", sections: [], notice: "" };
    var sec = null;
    var sub = null;
    var target = null; // 값이 이어질 곳(항목 또는 소제목)
    var lastItem = null; // 같은 묶음 안의 바로 앞 항목
    var inDashGroup = false; // "- 경구" 같은 "-" 제목 아래인지
    var table = null;
    var cols = null;

    function container() {
      return sub || sec;
    }

    for (var r = range.s.r; r <= range.e.r; r++) {
      var rawA = cellText(ws, XLSX, r, 0);
      var a = rawA.replace(/\s+$/, "");
      var t = a.trim();
      var others = [];
      for (var c = 1; c <= range.e.c; c++) {
        var v = cellText(ws, XLSX, r, c);
        if (v.trim()) {
          others.push({ c: c, text: v });
        }
      }
      if (!t && !others.length) {
        continue;
      }
      var fillA = cellFill(ws, XLSX, r, 0);

      if (t === "제품명" && others.length) {
        model.name = splitLines(others[0].text).join(" ");
        continue;
      }
      if (/MSDS\s*NO/i.test(t)) {
        var m = (t + " " + others.map(function (o) { return o.text; }).join(" ")).match(/[A-Z]{1,4}\d{3,8}-\d{4,14}/);
        model.msdsNo = m ? m[0] : "";
        continue;
      }
      var sm = t.match(SEC_RE);
      if (sm && (fillA === "E6E6FA" || !others.length) && /[가-힣]/.test(sm[2])) {
        sec = { num: Number(sm[1]), title: sm[2].replace(/\s+/g, " ").trim(), blocks: [] };
        model.sections.push(sec);
        sub = null;
        target = null;
        lastItem = null;
        inDashGroup = false;
        table = null;
        continue;
      }
      if (!sec) {
        continue;
      }
      // 구성성분 표
      var rowText = [t].concat(others.map(function (o) { return o.text; })).join(" ");
      if (!table && (fillA === "E8E8E8" || sec.num === 3) && /CAS/i.test(rowText)) {
        cols = { alias: -1, cas: -1, pct: -1 };
        others.forEach(function (o) {
          if (/CAS/i.test(o.text)) {
            cols.cas = o.c;
          } else if (/함유|%/.test(o.text)) {
            cols.pct = o.c;
          } else if (/이명|관용명/.test(o.text)) {
            cols.alias = o.c;
          }
        });
        table = { type: "table", rows: [] };
        sec.blocks.push(table);
        continue;
      }
      if (table && sec.num === 3) {
        var get = function (col) {
          var hit = others.filter(function (o) { return o.c === col; })[0];
          return hit ? splitLines(hit.text).join(" ") : "";
        };
        if (t || others.length) {
          table.rows.push({ name: t.replace(/\s+/g, " "), alias: get(cols.alias), cas: get(cols.cas), pct: get(cols.pct) });
        }
        continue;
      }
      // 맨 끝 안내문
      if (/^[○※]/.test(t) && sec.num === 16) {
        model.notice = splitLines(t.replace(/^[○※]\s*/, "") + " " + others.map(function (o) { return o.text; }).join(" ")).join(" ");
        continue;
      }
      var values = [];
      others.forEach(function (o) {
        values = values.concat(splitLines(o.text));
      });
      var lead = rawA.length - rawA.replace(/^\s+/, "").length;
      // A열 없이 값만 있는 줄, 또는 A열에 아주 깊이 들여 쓴 글(값 자리) → 위 항목에 이어 붙인다
      if (!t || (lead >= 30 && !values.length)) {
        var more = t ? splitLines(t) : values;
        if (target) {
          target.lines = target.lines.concat(more);
        } else {
          container().blocks.push({ type: "lines", lines: more });
        }
        continue;
      }
      var subm = t.match(SUB_RE);
      if (subm) {
        sub = { type: "sub", title: subm[1] + ". " + subm[2].replace(/\s+/g, " ").trim(), lines: values, blocks: [] };
        sec.blocks.push(sub);
        target = sub;
        lastItem = null;
        inDashGroup = false;
        continue;
      }
      var marker = (t.match(/^[*\-○·]/) || [""])[0];
      var label = t.replace(/^[*\-○·]\s*/, "").replace(/\s*,\s*$/, "").replace(/\s+/g, " ").trim();
      var level = marker === "*" ? 1 : marker === "-" ? 2 : lead >= 13 ? 3 : lead >= 10 ? 2 : 1;
      // 원본의 들여쓰기가 들쭉날쭉한 줄 보정: "- 경구" 같은 "-" 묶음 안에서 물질 줄·제목 줄 바로 다음의 표시 없는 값 있는 줄은 물질 줄
      if (!marker && values.length && inDashGroup && lastItem && (lastItem.level === 3 || (lastItem.level === 2 && lastItem.marker === "-" && !lastItem.lines.length))) {
        level = 3;
      }
      var item = { type: "item", label: label, level: level, marker: marker, lines: values, pictogram: /그림문자/.test(label) };
      container().blocks.push(item);
      target = item;
      lastItem = item;
      if (marker === "-") {
        inDashGroup = true;
      } else if (level === 1) {
        inDashGroup = false;
      }
    }
    return model;
  }

  // ---------- 그림문자: H코드 → GHS ----------
  var GHS_BY_H = [
    ["GHS01", /^H20[0-5]$|^H24[01]$/],
    ["GHS02", /^H22[0-8]$|^H24[12]$|^H25[0-2]$|^H26[01]$/],
    ["GHS03", /^H27[0-2]$/],
    ["GHS04", /^H28[01]$/],
    ["GHS05", /^H290$|^H314$|^H318$/],
    ["GHS06", /^H30[01]$|^H31[01]$|^H33[01]$/],
    ["GHS07", /^H302$|^H312$|^H332$|^H315$|^H317$|^H319$|^H335$|^H336$|^H420$/],
    ["GHS08", /^H304$|^H334$|^H34[01]$|^H35[01]$|^H36[01]$|^H37[0-3]$/],
    ["GHS09", /^H400$|^H41[01]$/]
  ];

  function pictogramsFor(model) {
    var codes = [];
    model.sections.forEach(function (s) {
      if (s.num !== 2) {
        return;
      }
      JSON.stringify(s).replace(/H\d{3}/g, function (h) {
        codes.push(h);
      });
    });
    var found = {};
    var why = {};
    codes.forEach(function (h) {
      GHS_BY_H.forEach(function (g) {
        if (g[1].test(h)) {
          found[g[0]] = true;
          (why[g[0]] = why[g[0]] || []).push(h);
        }
      });
    });
    // GHS 규칙: 해골(06)이 있으면 느낌표(07) 생략, 부식성(05)이 있으면 피부·눈 자극만으로 붙은 느낌표 생략
    if (found.GHS06) {
      delete found.GHS07;
    }
    if (found.GHS05 && found.GHS07 && why.GHS07.every(function (h) { return h === "H315" || h === "H319"; })) {
      delete found.GHS07;
    }
    return Object.keys(found).sort();
  }

  // ---------- 그리기 ----------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function lines(arr) {
    return arr.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("");
  }

  function kv(item, ghsImgs) {
    var mark = item.level === 1 ? '<i class="b">○</i>' : item.level === 2 ? '<i class="d">-</i>' : "";
    var value = item.pictogram && ghsImgs.length
      ? '<div class="v pict">' + ghsImgs.join("") + "</div>"
      : '<div class="v">' + lines(item.lines) + "</div>";
    return '<div class="kv lv' + item.level + (item.lines.length || item.pictogram ? "" : " head") + '"><div class="k">' + mark + esc(item.label) + "</div>" + value + "</div>";
  }

  function bulletList(arr) {
    return '<div class="list">' + arr.map(function (l) { return '<p class="li"><i>·</i>' + esc(l) + "</p>"; }).join("") + "</div>";
  }

  function blockHtml(b, ghsImgs) {
    if (b.type === "item") {
      return kv(b, ghsImgs);
    }
    if (b.type === "lines") {
      return '<div class="para">' + lines(b.lines) + "</div>";
    }
    if (b.type === "table") {
      return '<table class="comp"><thead><tr><th>화학물질명</th><th>관용명 및 이명</th><th>CAS번호</th><th>함유량(%)</th></tr></thead><tbody>' +
        b.rows.map(function (r) {
          return '<tr><td class="nm">' + esc(r.name) + "</td><td>" + (esc(r.alias) || "-") + '</td><td class="c">' + esc(r.cas || "-") + '</td><td class="c">' + esc(r.pct || "-") + "</td></tr>";
        }).join("") + "</tbody></table>";
    }
    // 소제목에 짧은 값 하나만 있으면 "나. 냄새   무취"처럼 한 줄로
    if (b.lines.length === 1 && !b.blocks.length && b.lines[0].length <= 60) {
      return '<div class="kv row"><div class="k">' + esc(b.title) + '</div><div class="v"><p>' + esc(b.lines[0]) + "</p></div></div>";
    }
    // 소제목: 값이 하나면 문단, 여럿이면 목록. 소제목에 바로 붙은 값과 아래 항목을 함께 그린다
    var body = b.lines.length > 1 ? bulletList(b.lines) : b.lines.length ? '<div class="para">' + lines(b.lines) + "</div>" : "";
    return '<div class="sub"><h3>' + esc(b.title) + "</h3>" + body + b.blocks.map(function (x) { return blockHtml(x, ghsImgs); }).join("") + "</div>";
  }

  var CSS =
    "*{box-sizing:border-box}html,body{margin:0;background:#fff}" +
    "body{width:184mm;font-family:'Pretendard','Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif;font-size:9pt;line-height:1.5;color:#1d1d1f}" +
    "p{margin:0}" +
    ".banner{display:flex;align-items:center;justify-content:space-between;height:17mm;margin:0 0 4mm;padding:0 6mm;border-radius:1.5mm;color:#fff;background:linear-gradient(105deg,#12306e 0%,#1d4fa3 62%,#2d6fd0 100%)}" +
    ".banner h1{margin:0;font-size:17pt;font-weight:700;letter-spacing:.02em}" +
    ".banner h1 small{display:block;font-size:7.5pt;font-weight:500;letter-spacing:.18em;opacity:.8}" +
    ".brand{display:flex;align-items:center;gap:2.5mm;background:#fff;border-radius:1.2mm;padding:1.2mm 3mm}" +
    ".brand img{height:9mm}.brand b{color:#12306e;font-size:9.5pt;line-height:1.25}" +
    ".brand b span{display:block;font-size:6.5pt;font-weight:600;color:#6b7280;letter-spacing:.08em}" +
    ".meta{display:flex;justify-content:space-between;align-items:center;margin:0 0 3mm}" +
    ".meta .prod{font-size:11pt;font-weight:700;color:#12306e}.meta .prod small{color:#555;font-weight:500;font-size:8.5pt;margin-left:2mm}" +
    ".msdsno{display:inline-flex;border:.3mm solid #12306e;border-radius:1mm;overflow:hidden;font-size:9pt}" +
    ".msdsno b{background:#12306e;color:#fff;padding:1mm 3mm;font-weight:600}.msdsno span{padding:1mm 3.5mm;font-weight:600;letter-spacing:.02em}" +
    ".sec{margin:0 0 4.5mm}" +
    "h2{margin:0 0 2mm;padding:1.6mm 3mm;font-size:11.5pt;font-weight:700;color:#12306e;background:#eceefb;border-left:1.2mm solid #1d4fa3;border-radius:0 1mm 1mm 0}" +
    "h2 .num{color:#1d4fa3}" +
    ".sub{margin:0 0 2mm 2mm}h3{margin:1.5mm 0 1mm;font-size:9.5pt;font-weight:700;color:#111}" +
    ".kv{display:grid;grid-template-columns:52mm 1fr;column-gap:3mm;padding:.55mm 0}" +
    ".sec>.kv{margin-left:2mm}.kv .k{position:relative}" +
    ".kv.row{margin-left:2mm}.kv.row .k{font-weight:700;color:#111}" +
    ".kv.lv1 .k{padding-left:4mm}.kv.lv2 .k{padding-left:10mm;color:#333}.kv.lv3 .k{padding-left:15mm;color:#444}" +
    ".k .b{position:absolute;left:0;font-style:normal;color:#1d4fa3}.k .d{position:absolute;left:6.5mm;font-style:normal;color:#777}" +
    ".v p+p{margin-top:.3mm}.para{padding:.3mm 0 .3mm 4mm}" +
    ".list{padding:0 0 0 8mm}.list .li{position:relative;padding-left:3mm;margin:0 0 .4mm}" +
    ".list .li i{position:absolute;left:0;font-style:normal;font-weight:700;color:#1d4fa3}" +
    ".pict{display:flex;gap:3mm;flex-wrap:wrap}.pict img{width:20mm;height:20mm}" +
    "table.comp{width:100%;border-collapse:collapse;margin:1mm 0 0;font-size:8.5pt}" +
    "table.comp th{padding:1.6mm 2mm;font-weight:700;color:#12306e;background:#f4f5fc;border-top:.45mm solid #12306e;border-bottom:.3mm solid #12306e;text-align:center}" +
    "table.comp td{padding:1.6mm 2mm;border-bottom:.25mm dotted #8a8fa3;vertical-align:middle}" +
    "table.comp td.nm{font-weight:600;width:28%}table.comp td.c{text-align:center;white-space:nowrap;width:14%}" +
    "table.comp tbody tr:last-child td{border-bottom:.45mm solid #12306e}" +
    ".notice{margin-top:3mm;padding:2.5mm 3.5mm;font-size:8.5pt;color:#333;background:#f6f7fb;border:.25mm solid #d5d8e8;border-radius:1mm}";

  function toHtml(model, meta, assets) {
    var ghsImgs = pictogramsFor(model).map(function (code) {
      return assets.ghs[code] ? '<img src="' + assets.ghs[code] + '" alt="' + code + '">' : "";
    }).filter(Boolean);
    var body =
      '<header class="banner"><h1>물질안전보건자료 (MSDS)<small>MATERIAL SAFETY DATA SHEET</small></h1>' +
      '<div class="brand">' + (assets.logo ? '<img src="' + assets.logo + '" alt="">' : "") + "<b>대양피앤티㈜<span>DAEYANG P&amp;T</span></b></div></header>" +
      '<div class="meta"><div class="prod">' + esc(meta.name || model.name) + (meta.code ? "<small>" + esc(meta.code) + "</small>" : "") + "</div>" +
      '<div class="msdsno"><b>MSDS 번호</b><span>' + esc(meta.msdsNo || model.msdsNo || "-") + "</span></div></div>" +
      model.sections.map(function (s) {
        return '<section class="sec"><h2><span class="num">' + s.num + ".</span> " + esc(s.title) + "</h2>" +
          s.blocks.map(function (b) { return blockHtml(b, ghsImgs); }).join("") + "</section>";
      }).join("") +
      (model.notice ? '<div class="notice">※ ' + esc(model.notice) + "</div>" : "");
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">' +
      "<style>" + CSS + "</style></head><body>" + body + "</body></html>";
  }

  // ---------- 그림 파일(로고·GHS) 한 번만 읽어 두기 ----------
  var assetsPromise = null;

  function toDataUrl(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        throw new Error(url);
      }
      return res.blob();
    }).then(function (blob) {
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.readAsDataURL(blob);
      });
    }).catch(function () { return ""; });
  }

  function loadAssets() {
    if (!assetsPromise) {
      var codes = ["GHS01", "GHS02", "GHS03", "GHS04", "GHS05", "GHS06", "GHS07", "GHS08", "GHS09"];
      assetsPromise = Promise.all([toDataUrl("../images/logo-dyp.png")].concat(codes.map(function (c) { return toDataUrl("ghs/" + c + ".svg"); })))
        .then(function (list) {
          var ghs = {};
          codes.forEach(function (c, i) { ghs[c] = list[i + 1]; });
          return { logo: list[0], ghs: ghs };
        });
    }
    return assetsPromise;
  }

  // ---------- PDF ----------
  var PX_PER_MM = 96 / 25.4;
  var PAGE_W = 210 * PX_PER_MM;
  var PAGE_H = 297 * PX_PER_MM;
  var M_TOP = 14 * PX_PER_MM;
  var M_BOTTOM = 16 * PX_PER_MM;
  var M_LEFT = 13 * PX_PER_MM;
  var CONTENT_W = 184 * PX_PER_MM;
  var CONTENT_H = PAGE_H - M_TOP - M_BOTTOM;

  function renderFrame(html) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:" + Math.ceil(CONTENT_W) + "px;height:1200px;border:0;visibility:hidden;";
      frame.onload = function () {
        var doc = frame.contentDocument;
        var imgs = Array.prototype.slice.call(doc.images);
        var timeout = new Promise(function (r) { setTimeout(r, 4000); });
        Promise.race([Promise.all(imgs.map(function (img) {
          return img.complete ? null : new Promise(function (r) { img.onload = img.onerror = r; });
        })).then(function () { return doc.fonts && doc.fonts.ready; }), timeout]).then(function () { resolve(frame); });
      };
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
  }

  // 쪽 나누기: 줄(항목·목록 한 줄·표 행) 사이에서만 자르고, 제목은 다음 내용과 붙여 둔다
  function pageCuts(doc, totalH) {
    var y = doc.defaultView.scrollY;
    var nodes = Array.prototype.slice.call(doc.querySelectorAll(".banner,.meta,h2,h3,.kv,.para p,.list .li,table.comp,.notice"));
    var blocks = [];
    nodes.forEach(function (n) {
      if (n.tagName === "TABLE") {
        var tr = n.getBoundingClientRect();
        if (tr.height <= CONTENT_H * 0.95) {
          blocks.push({ top: tr.top + y, bottom: tr.bottom + y, head: false });
        } else {
          Array.prototype.forEach.call(n.querySelectorAll("tr"), function (row, i) {
            var rr = row.getBoundingClientRect();
            blocks.push({ top: rr.top + y, bottom: rr.bottom + y, head: i === 0 });
          });
        }
        return;
      }
      var r = n.getBoundingClientRect();
      blocks.push({ top: r.top + y, bottom: r.bottom + y, head: n.tagName === "H2" || n.tagName === "H3" });
    });
    blocks.sort(function (a, b) { return a.top - b.top; });
    var cuts = [0];
    var start = 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.bottom - start <= CONTENT_H) {
        continue;
      }
      var cut = b.top;
      var j = i - 1;
      while (j >= 0 && blocks[j].head && blocks[j].top > start) {
        cut = blocks[j].top;
        j--;
      }
      if (cut <= start + 1) {
        cut = start + CONTENT_H;
      }
      cuts.push(cut);
      start = cut;
      while (i + 1 < blocks.length && blocks[i].bottom - start > CONTENT_H) {
        i++;
      }
    }
    while (totalH - start > CONTENT_H) {
      start += CONTENT_H;
      cuts.push(start);
    }
    cuts.push(totalH);
    return cuts;
  }

  async function toPdf(model, meta) {
    if (!root.html2canvas || !root.jspdf) {
      throw new Error("PDF 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    }
    var assets = await loadAssets();
    var frame = await renderFrame(toHtml(model, meta, assets));
    try {
      var doc = frame.contentDocument;
      var totalH = Math.ceil(doc.documentElement.scrollHeight);
      frame.style.height = totalH + "px";
      var cuts = pageCuts(doc, totalH);
      var scale = Math.min(1.8, 30000 / totalH);
      var canvas = await root.html2canvas(doc.documentElement, {
        scale: scale, width: Math.ceil(CONTENT_W), height: totalH, windowWidth: Math.ceil(CONTENT_W), windowHeight: totalH,
        backgroundColor: "#ffffff", logging: false
      });
      var pdf = new root.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      var page = document.createElement("canvas");
      page.width = Math.round(PAGE_W * scale);
      page.height = Math.round(PAGE_H * scale);
      var ctx = page.getContext("2d");
      var total = cuts.length - 1;
      var footLeft = [meta.code, meta.name || model.name].filter(Boolean).join(" · ");
      for (var p = 0; p < total; p++) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, page.width, page.height);
        var y0 = Math.round(cuts[p] * scale);
        var h = Math.max(1, Math.round(cuts[p + 1] * scale) - y0);
        ctx.drawImage(canvas, 0, y0, canvas.width, h, Math.round(M_LEFT * scale), Math.round(M_TOP * scale), canvas.width, h);
        // 바닥글: 왼쪽 제품, 가운데 회사, 오른쪽 쪽 번호
        var fy = Math.round((PAGE_H - 7 * PX_PER_MM) * scale);
        ctx.textBaseline = "alphabetic";
        ctx.font = Math.round(7.5 * scale * 1.333) + "px 'Pretendard','Malgun Gothic',sans-serif";
        ctx.fillStyle = "#666";
        ctx.textAlign = "left";
        ctx.fillText(footLeft, Math.round(M_LEFT * scale), fy);
        ctx.textAlign = "right";
        ctx.fillText((p + 1) + " / " + total, Math.round((PAGE_W - M_LEFT) * scale), fy);
        ctx.textAlign = "center";
        ctx.fillStyle = "#12306e";
        ctx.font = "bold " + Math.round(7.5 * scale * 1.333) + "px 'Pretendard','Malgun Gothic',sans-serif";
        ctx.fillText("대양피앤티주식회사", Math.round(PAGE_W / 2 * scale), fy);
        if (p > 0) {
          pdf.addPage();
        }
        pdf.addImage(page.toDataURL("image/jpeg", 0.82), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      return pdf.output("blob");
    } finally {
      frame.remove();
    }
  }

  root.DY_MSDS_FRM = { parse: parse, toHtml: toHtml, pictogramsFor: pictogramsFor, loadAssets: loadAssets, toPdf: toPdf };
})(window);
