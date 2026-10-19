// 관리자 패널: 제품 라벨 출력 (가로 130mm × 세로 150mm, Zebra ZT421)
//  품명·제품코드로 등록된 MSDS를 찾아, MSDS의 유해·위험문구(H코드)로 GHS 그림문자와 신호어를 불러오고,
//  유해·위험문구·예방조치문구·공급원도 MSDS에서 가져와 라벨 아래쪽에 넣는다.
//  - MSDS 읽는 순서: 원본 보관함의 엑셀 → 홈페이지에 걸린 엑셀 → PDF 글자
//  - 출력: [인쇄] 브라우저 인쇄(ZDesigner 드라이버), [ZPL 저장] 라벨 전체를 그림으로 바꾼 ZPL 파일 (한글 글꼴이 프린터에 없어도 됨)
(function () {
  var A = window.DY_ADMIN;
  var LABEL_W_MM = 130;
  var LABEL_H_MM = 150;
  var SETTINGS_KEY = "dy-label-settings";
  var LOT_KEY = "dy-label-lot";
  var GHS_CODES = ["GHS01", "GHS02", "GHS03", "GHS04", "GHS05", "GHS06", "GHS07", "GHS08", "GHS09"];
  var GHS_NAME = {
    GHS01: "폭발성",
    GHS02: "인화성",
    GHS03: "산화성",
    GHS04: "고압가스",
    GHS05: "부식성",
    GHS06: "급성독성",
    GHS07: "경고(느낌표)",
    GHS08: "건강유해성",
    GHS09: "환경유해성"
  };
  // 라벨 아래쪽 항목 (두 번째 라벨 견본 순서)
  var FIELDS = [
    ["dry", "건조조건"],
    ["lot", "제조번호"],
    ["date", "제조일자"],
    ["keep", "저장기간"],
    ["weight", "실중량"],
    ["kind", "종류"]
  ];
  var DEFAULTS = {
    dry: "200℃ X 10분",
    keep: "12개월",
    weight: "20KG",
    dpi: "203",
    rotate: false,
    notice: "※ 기타 자세한 사항은 물질안전보건자료(MSDS)를 참조하시기 바랍니다.",
    supplier: ""
  };
  // 문구 앞 코드: "H351", "P301+P312" 등
  var STMT_CODE_RE = /^([HP]\d{3}[A-Za-z]?(?:\s*\+\s*[HP]\d{3}[A-Za-z]?)*)\s*[:：]?\s*/;

  var LABEL_CSS =
    ".lb-label{width:" + LABEL_W_MM + "mm;height:" + LABEL_H_MM + "mm;padding:2.5mm;box-sizing:border-box;background:#fff;color:#000;overflow:hidden;" +
    "font-family:'Batang','바탕','BatangChe','Noto Serif KR','Nanum Myeongjo',serif;}" +
    ".lb-label *{box-sizing:border-box;}" +
    ".lb-frame{height:100%;border:0.7mm solid #000;padding:0.6mm;}" +
    ".lb-inner{height:100%;border:0.25mm solid #000;display:flex;flex-direction:column;}" +
    ".lb-head{text-align:center;padding:1.6mm 2mm 1mm;}" +
    ".lb-code{font-size:8mm;line-height:1.1;white-space:nowrap;letter-spacing:0.2mm;}" +
    ".lb-resin{font-size:3.6mm;line-height:1.3;margin-top:0.6mm;}" +
    ".lb-name{border-top:0.25mm solid #000;border-bottom:0.25mm solid #000;padding:1.4mm 2mm;text-align:center;white-space:nowrap;" +
    "font-family:'HY견명조','HYGyeonMyeongJo','Batang','바탕','Noto Serif KR',serif;font-weight:700;font-size:10mm;line-height:1.15;}" +
    ".lb-body{flex:1;display:flex;gap:2mm;padding:2mm 3mm 2mm 4mm;min-height:0;}" +
    ".lb-label.has-hz .lb-body{flex:none;height:55mm;}" +
    ".lb-fields{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;font-size:4.6mm;line-height:1.2;min-width:0;}" +
    ".lb-row{display:flex;align-items:baseline;white-space:nowrap;}" +
    ".lb-key{display:flex;justify-content:space-between;width:19mm;flex:none;}" +
    ".lb-colon{margin:0 2mm 0 1.6mm;flex:none;}" +
    ".lb-val{overflow:hidden;}" +
    ".lb-haz{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2mm;}" +
    ".lb-ghs{display:flex;flex-wrap:wrap;justify-content:center;}" +
    ".lb-ghs img{display:block;}" +
    ".lb-signal{font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;font-weight:700;font-size:5mm;line-height:1;}" +
    // 유해·위험문구 / 예방조치문구 (첫 번째 라벨 견본처럼 왼쪽에 세로 제목)
    ".lb-hz{flex:1;min-height:0;display:flex;border-top:0.25mm solid #000;font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;}" +
    ".lb-hz-col{display:flex;min-width:0;}" +
    ".lb-hz-col.h{flex:0 0 33%;}" +
    ".lb-hz-col.p{flex:1;border-left:0.25mm solid #000;}" +
    ".lb-hz-tag{flex:none;width:5.2mm;border-right:0.25mm solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:2.9mm;line-height:1.08;font-weight:700;}" +
    ".lb-hz-text{flex:1;min-width:0;overflow:hidden;padding:1mm 1.4mm;font-size:2.7mm;line-height:1.32;word-break:keep-all;overflow-wrap:anywhere;}" +
    ".lb-hz-text p{margin:0;}" +
    ".lb-foot{flex:none;border-top:0.25mm solid #000;padding:0.8mm 2mm;text-align:center;font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;font-size:2.4mm;line-height:1.35;}" +
    ".lb-foot b{font-weight:700;}";

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 저장 못해도 동작에는 문제 없음 */
    }
  }

  function today() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // 2026-10-19 → 2026년 10월 19일
  function koDate(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[1] + "년 " + m[2] + "월 " + m[3] + "일" : String(iso || "");
  }

  function setMsg(node, text, kind) {
    node.textContent = text;
    node.className = "a-msg" + (kind ? " is-" + kind : "");
  }

  function ext(path) {
    return (String(path || "").match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  }

  // 제조번호: DYP + 연(2) + 월(2) + 일련번호(4). 같은 달에 마지막으로 쓴 번호가 있으면 다음 번호를 제안한다.
  function lotPrefix(iso) {
    var m = String(iso || today()).match(/^\d{2}(\d{2})-(\d{2})/);
    return "DYP" + (m ? m[1] + m[2] : "");
  }

  function suggestLot(iso) {
    var prefix = lotPrefix(iso);
    var last = String(readJson(LOT_KEY, "") || "");
    var m = last.match(/^(DYP\d{4})(\d+)$/);
    if (m && m[1] === prefix) {
      var next = String(Number(m[2]) + 1);
      return prefix + "0000".slice(next.length) + next;
    }
    return prefix + "0001";
  }

  // ---------- MSDS에서 그림문자·신호어·종류 읽기 ----------
  function walkItems(blocks, fn) {
    (blocks || []).forEach(function (b) {
      if (b.type === "item") {
        fn(b);
      }
      if (b.blocks) {
        walkItems(b.blocks, fn);
      }
    });
  }

  // "폴리에스테르계 분체도료 일반용" → { kind: "폴리에스테르계", resin: "폴리에스테르" }
  function kindFromUsage(text) {
    var m = String(text || "").match(/([가-힣A-Za-z/·,]+?)\s*계/);
    if (!m) {
      return { kind: "", resin: "" };
    }
    var resin = m[1];
    return { kind: resin + "계", resin: resin };
  }

  // 코드로 시작하는 줄마다 문구 하나. 코드 없는 줄은 앞 문구에 이어 붙이고, 같은 문구는 한 번만 둔다.
  function statements(lines, letter) {
    var out = [];
    lines.forEach(function (l) {
      l = String(l).replace(/\s+/g, " ").trim();
      if (!l) {
        return;
      }
      if (new RegExp("^" + letter + "\\d{3}").test(l) || !out.length) {
        out.push(l);
      } else {
        out[out.length - 1] += " " + l;
      }
    });
    return out.filter(function (x, i) { return out.indexOf(x) === i; });
  }

  function supplierLine(name, addr, tel) {
    return [name && "공급원: " + name, addr, tel && "Tel " + tel].filter(Boolean).join(" · ");
  }

  function infoFromModel(model) {
    var out = { codes: [], signal: "", usage: "", h: [], p: [], supplier: "" };
    var hLines = [];
    var pLines = [];
    var sup = {};
    model.sections.forEach(function (s) {
      walkItems(s.blocks, function (item) {
        if (s.num === 2 && /신호어/.test(item.label) && item.lines.length) {
          out.signal = item.lines[0];
        }
        if (s.num === 2 && /유해\W{0,2}위험\s*문구/.test(item.label)) {
          hLines = hLines.concat(item.lines);
        }
        if (s.num === 2 && /^(예방|대응|저장|폐기)$|예방\s*조치\s*문구/.test(item.label.replace(/\s+/g, ""))) {
          pLines = pLines.concat(item.lines);
        }
        if (s.num === 1 && /권고\s*용도/.test(item.label) && item.lines.length && !out.usage) {
          out.usage = item.lines.join(" ");
        }
        if (s.num === 1 && item.lines.length) {
          if (/회사\s*명/.test(item.label) && !sup.name) { sup.name = item.lines.join(" "); }
          if (/^주\s*소$/.test(item.label) && !sup.addr) { sup.addr = item.lines.join(" "); }
          if (/긴급\s*전화|전화\s*번호/.test(item.label) && !sup.tel) { sup.tel = item.lines.join(" "); }
        }
      });
      if (s.num === 2) {
        JSON.stringify(s).replace(/H\d{3}/g, function (h) {
          out.codes.push(h);
        });
      }
    });
    out.h = statements(hLines, "H");
    out.p = statements(pLines, "P");
    out.supplier = supplierLine(sup.name, sup.addr, sup.tel);
    return out;
  }

  async function pdfText(bytes) {
    var pdfjs = window.pdfjsLib;
    if (!pdfjs) {
      throw new Error("PDF 읽기 도구를 불러오지 못했습니다.");
    }
    var doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise;
    var text = "";
    for (var n = 1; n <= Math.min(doc.numPages, 3); n++) {
      var page = await doc.getPage(n);
      var content = await page.getTextContent();
      text += content.items.map(function (it) { return it.str + (it.hasEOL ? "\n" : " "); }).join("") + "\n";
    }
    doc.destroy();
    return text;
  }

  function infoFromText(text) {
    var flat = text.replace(/[ \t]+/g, " ");
    var start = flat.search(/2\s*\.\s*유해\s*성/);
    var end = flat.search(/3\s*\.\s*구성\s*성분/);
    var sec2 = start >= 0 ? flat.slice(start, end > start ? end : undefined) : flat;
    var signal = (sec2.match(/신호어\s*[:：]?\s*(위험|경고)/) || [])[1] || "";
    var usage = (flat.match(/권고\s*용도\s*[:：]?\s*([^\n]+)/) || [])[1] || "";
    function pick(re) {
      return ((flat.match(re) || [])[1] || "").trim();
    }
    return {
      codes: sec2.match(/H\d{3}/g) || [],
      signal: signal,
      usage: usage,
      h: textStatements(sec2, "H"),
      p: textStatements(sec2, "P"),
      supplier: supplierLine(pick(/회사\s*명\s*[:：]?\s*([^\n]+)/), pick(/주\s*소\s*[:：]?\s*([^\n]+)/), pick(/긴급\s*전화\s*번호\s*[:：]?\s*([^\n]+)/))
    };
  }

  // PDF 글자에서 문구 찾기: 코드부터 다음 코드 앞까지를 문구 하나로 본다
  function textStatements(sec2, letter) {
    var out = [];
    var re = new RegExp("(" + letter + "\\d{3}(?:\\s*\\+\\s*" + letter + "\\d{3})*)\\s*([\\s\\S]*?)(?=[HP]\\d{3}|$)", "g");
    var m;
    while ((m = re.exec(sec2))) {
      var t = m[2].replace(/\s+/g, " ")
        .split(/예방\s*조치\s*문구|다\s*\.\s*유해/)[0]
        .replace(/\s*(예방|대응|저장|폐기)\s*[:：]?\s*$/, "")
        .trim();
      if (t) {
        out.push(m[1].replace(/\s+/g, "") + " " + t);
      }
    }
    return out.filter(function (x, i) { return out.indexOf(x) === i; });
  }

  async function download(sb, bucket, path) {
    var dl = await sb.storage.from(bucket).download(path);
    if (dl.error) {
      throw new Error("파일을 받지 못했습니다: " + dl.error.message);
    }
    return new Uint8Array(await dl.data.arrayBuffer());
  }

  // 한 제품의 MSDS에서 { pictos, signal, kind, resin, codes, source } 를 읽는다.
  async function readHazard(sb, row, archive) {
    var bucket = window.DY_MSDS_BUCKET || "msds-files";
    var tries = [];
    (archive || []).forEach(function (a) {
      if (a.file_type !== "application/pdf" && /^xlsx?$/.test(ext(a.archive_path))) {
        tries.push({ bucket: "msds-archive", path: a.archive_path, kind: "xls", label: "원본 보관함 엑셀" });
      }
    });
    if (/^xlsx?$/.test(ext(row.file_path))) {
      tries.push({ bucket: bucket, path: row.file_path, kind: "xls", label: "등록된 엑셀" });
    }
    if (ext(row.file_path) === "pdf") {
      tries.push({ bucket: bucket, path: row.file_path, kind: "pdf", label: "등록된 PDF" });
    }
    (archive || []).forEach(function (a) {
      if (ext(a.archive_path) === "pdf") {
        tries.push({ bucket: "msds-archive", path: a.archive_path, kind: "pdf", label: "원본 보관함 PDF" });
      }
    });
    var lastErr = null;
    for (var i = 0; i < tries.length; i++) {
      var t = tries[i];
      try {
        var bytes = await download(sb, t.bucket, t.path);
        var info;
        if (t.kind === "xls") {
          var model = window.DY_MSDS_FRM.parse(bytes, window.XLSX);
          if (model.sections.length < 3) {
            throw new Error("MSDS 양식을 읽지 못했습니다");
          }
          info = infoFromModel(model);
        } else {
          info = infoFromText(await pdfText(bytes));
        }
        // 글자가 없는 PDF(그림으로 만든 PDF)는 다음 파일로 넘어간다
        if (!info.codes.length && !info.signal && t.kind === "pdf") {
          throw new Error("PDF에서 글자를 읽지 못했습니다");
        }
        var k = kindFromUsage(info.usage);
        return {
          pictos: window.DY_MSDS_FRM.pictogramsForCodes(info.codes),
          codes: info.codes.filter(function (h, j, arr) { return arr.indexOf(h) === j; }),
          signal: info.signal,
          kind: k.kind,
          resin: k.resin,
          h: info.h,
          p: info.p,
          supplier: info.supplier,
          source: t.label
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("읽을 수 있는 MSDS 파일이 없습니다");
  }

  // ---------- 라벨 그리기 ----------
  function ghsLayout(n) {
    // 그림문자 수에 따라 크기·칸 수를 정한다 (mm)
    if (n <= 1) { return { size: 26, cols: 1 }; }
    if (n === 2) { return { size: 21, cols: 1 }; }
    if (n <= 4) { return { size: 20, cols: 2 }; }
    return { size: 15.5, cols: 3 };
  }

  function buildLabelHtml(d, ghsSrc) {
    function esc(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    var rows = FIELDS.map(function (f) {
      var key = f[1].split("").map(function (ch) { return "<span>" + esc(ch) + "</span>"; }).join("");
      var val = f[0] === "date" ? koDate(d.date) : d[f[0]];
      return '<div class="lb-row"><span class="lb-key">' + key + '</span><span class="lb-colon">:</span><span class="lb-val">' + esc(val) + "</span></div>";
    }).join("");
    var haz = "";
    if (d.pictos.length || d.signal) {
      var lay = ghsLayout(d.pictos.length);
      var imgs = d.pictos.map(function (c) {
        return '<img src="' + esc(ghsSrc[c] || "ghs/" + c + ".svg") + '" alt="' + c + '" style="width:' + lay.size + "mm;height:" + lay.size + 'mm">';
      }).join("");
      haz = '<div class="lb-haz"><div class="lb-ghs" style="width:' + (lay.size * lay.cols) + 'mm">' + imgs + "</div>" +
        (d.signal ? '<div class="lb-signal">' + esc(d.signal) + "</div>" : "") + "</div>";
    }
    function tag(text) {
      return '<div class="lb-hz-tag">' + text.split("").map(function (ch) { return "<span>" + esc(ch) + "</span>"; }).join("") + "</div>";
    }
    function stmt(line) {
      return d.showCodes ? line : line.replace(STMT_CODE_RE, "");
    }
    var hz = "";
    if (d.h.length || d.p.length) {
      hz = '<div class="lb-hz">' +
        '<div class="lb-hz-col h">' + tag("유해위험문구") + '<div class="lb-hz-text"><p>' + d.h.map(function (l) { return esc(stmt(l)); }).join(" / ") + "</p></div></div>" +
        '<div class="lb-hz-col p">' + tag("예방조치문구") + '<div class="lb-hz-text">' + d.p.map(function (l) { return "<p>· " + esc(stmt(l)) + "</p>"; }).join("") + "</div></div>" +
        "</div>";
    }
    var foot = d.notice || d.supplier
      ? '<div class="lb-foot">' + (d.notice ? "<b>" + esc(d.notice) + "</b>" : "") + (d.notice && d.supplier ? "<br>" : "") + esc(d.supplier) + "</div>"
      : "";
    return '<div class="lb-label' + (hz ? " has-hz" : "") + '"><div class="lb-frame"><div class="lb-inner">' +
      '<div class="lb-head"><div class="lb-code">' + esc(d.code) + "</div>" +
      (d.resin ? '<div class="lb-resin">(' + esc(d.resin) + ")</div>" : "") + "</div>" +
      '<div class="lb-name">' + esc(d.name) + "</div>" +
      '<div class="lb-body"><div class="lb-fields">' + rows + "</div>" + haz + "</div>" +
      hz + foot +
      "</div></div></div>";
  }

  // 한 줄 글자가 칸을 넘으면 글자 크기를 줄인다. 문구 칸은 넘치지 않을 때까지 줄이고, 최소 크기에서도 넘치면 true를 돌려준다.
  function fitText(root) {
    var overflow = false;
    [".lb-name", ".lb-code"].forEach(function (sel) {
      var node = root.querySelector(sel);
      if (!node) {
        return;
      }
      node.style.fontSize = "";
      var size = parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).fontSize);
      var guard = 0;
      while (node.scrollWidth > node.clientWidth + 1 && size > 8 && guard++ < 80) {
        size -= 1;
        node.style.fontSize = size + "px";
      }
    });
    Array.prototype.forEach.call(root.querySelectorAll(".lb-val"), function (node) {
      node.style.fontSize = "";
      var size = parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).fontSize);
      var guard = 0;
      while (node.scrollWidth > node.clientWidth + 1 && size > 7 && guard++ < 40) {
        size -= 1;
        node.style.fontSize = size + "px";
      }
    });
    Array.prototype.forEach.call(root.querySelectorAll(".lb-hz-text"), function (node) {
      node.style.fontSize = "";
      var size = parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).fontSize);
      var guard = 0;
      while (node.scrollHeight > node.clientHeight + 1 && size > 5.5 && guard++ < 60) {
        size -= 0.25;
        node.style.fontSize = size + "px";
      }
      if (node.scrollHeight > node.clientHeight + 1) {
        overflow = true;
      }
    });
    return overflow;
  }

  function imagesReady(root) {
    return Promise.all(Array.prototype.map.call(root.querySelectorAll("img"), function (img) {
      return img.complete ? null : new Promise(function (r) { img.onload = img.onerror = r; });
    }));
  }

  // ---------- 브라우저 인쇄 (라벨 크기 쪽으로) ----------
  function printLabels(d, ghsSrc, copies) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      var one = buildLabelHtml(d, ghsSrc);
      var pages = [];
      for (var i = 0; i < copies; i++) {
        pages.push(one);
      }
      frame.srcdoc = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="' + document.baseURI + '"><style>' + LABEL_CSS +
        "@page{size:" + LABEL_W_MM + "mm " + LABEL_H_MM + "mm;margin:0;}html,body{margin:0;padding:0;background:#fff;}" +
        ".lb-label{break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
        ".lb-label:last-child{break-after:auto;page-break-after:auto;}</style></head><body>" + pages.join("") + "</body></html>";
      frame.onload = async function () {
        var doc = frame.contentDocument;
        await imagesReady(doc);
        if (doc.fonts && doc.fonts.ready) {
          await doc.fonts.ready;
        }
        Array.prototype.forEach.call(doc.querySelectorAll(".lb-label"), fitText);
        var done = function () {
          setTimeout(function () { frame.remove(); }, 500);
          resolve();
        };
        frame.contentWindow.addEventListener("afterprint", done);
        frame.contentWindow.focus();
        frame.contentWindow.print();
        // afterprint가 오지 않는 브라우저 대비
        setTimeout(done, 60000);
      };
      document.body.appendChild(frame);
    });
  }

  // ---------- ZPL (라벨 전체를 흑백 그림으로) ----------
  // 같은 글자가 이어지면 Zebra 압축 표기(G~Y: 1~19, g~z: 20~400)로 줄인다.
  function zplCount(n) {
    var s = "";
    while (n >= 400) {
      s += "z";
      n -= 400;
    }
    if (n >= 20) {
      s += String.fromCharCode(102 + Math.floor(n / 20));
      n %= 20;
    }
    if (n > 0) {
      s += String.fromCharCode(70 + n);
    }
    return s;
  }

  function zplRow(hex, prev) {
    if (hex === prev) {
      return ":";
    }
    var tail = "";
    var body = hex;
    if (/0+$/.test(body)) {
      body = body.replace(/0+$/, "");
      tail = ",";
    } else if (/F+$/.test(body)) {
      body = body.replace(/F+$/, "");
      tail = "!";
    }
    var out = "";
    var i = 0;
    while (i < body.length) {
      var j = i;
      while (j < body.length && body[j] === body[i]) {
        j++;
      }
      out += (j - i > 1 ? zplCount(j - i) : "") + body[i];
      i = j;
    }
    return out + tail;
  }

  function canvasToZpl(canvas, copies) {
    var w = canvas.width;
    var h = canvas.height;
    var px = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    var bpr = Math.ceil(w / 8);
    var HEX = "0123456789ABCDEF";
    var parts = [];
    var prev = null;
    for (var y = 0; y < h; y++) {
      var hex = "";
      for (var bx = 0; bx < bpr; bx++) {
        var byte = 0;
        for (var bit = 0; bit < 8; bit++) {
          var x = bx * 8 + bit;
          if (x < w) {
            var o = (y * w + x) * 4;
            var lum = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
            if (lum < 160) {
              byte |= 0x80 >> bit;
            }
          }
        }
        hex += HEX[byte >> 4] + HEX[byte & 15];
      }
      parts.push(zplRow(hex, prev));
      prev = hex;
    }
    var total = bpr * h;
    return "^XA\n^CI28\n^PW" + w + "\n^LL" + h + "\n^LH0,0\n^FO0,0^GFA," + total + "," + total + "," + bpr + "," + parts.join("") + "^FS\n^PQ" + copies + "\n^XZ\n";
  }

  async function labelCanvas(d, ghsSrc, dpi, rotate) {
    if (!window.html2canvas) {
      throw new Error("그림 변환 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    }
    var holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;";
    holder.innerHTML = "<style>" + LABEL_CSS + "</style>" + buildLabelHtml(d, ghsSrc);
    document.body.appendChild(holder);
    try {
      var node = holder.querySelector(".lb-label");
      await imagesReady(node);
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      fitText(node);
      var shot = await window.html2canvas(node, { scale: dpi / 96, backgroundColor: "#ffffff", logging: false, useCORS: true });
      var W = Math.round(LABEL_W_MM / 25.4 * dpi);
      var H = Math.round(LABEL_H_MM / 25.4 * dpi);
      var out = document.createElement("canvas");
      out.width = rotate ? H : W;
      out.height = rotate ? W : H;
      var ctx = out.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
      if (rotate) {
        ctx.translate(H, 0);
        ctx.rotate(Math.PI / 2);
      }
      ctx.drawImage(shot, 0, 0, W, H);
      return out;
    } finally {
      holder.remove();
    }
  }

  function saveFile(text, name) {
    var url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // ---------- 화면 ----------
  window.DY_LABEL_PRINT = async function (main) {
    var sb = A.sb;
    var el = A.el;
    var saved = Object.assign({}, DEFAULTS, readJson(SETTINGS_KEY, {}));
    var rows = [];
    var archiveBy = {};
    var ghsSrc = {};
    var current = null; // 고른 MSDS 행
    var loadSeq = 0;

    if (!document.getElementById("lb-style")) {
      document.head.appendChild(el("style", { id: "lb-style", text: LABEL_CSS }));
    }

    var msg = el("p", { class: "a-msg", role: "status" });
    var hazMsg = el("p", { class: "a-msg", role: "status" });
    var search = el("input", { type: "search", placeholder: "품명 또는 제품코드 입력 (예: PANTONE 3985C, YL043)", autocomplete: "off" });
    var results = el("ul", { class: "lb-results" });

    var f = {
      code: el("input", { type: "text", maxlength: "60" }),
      resin: el("input", { type: "text", maxlength: "40", placeholder: "예: 폴리에스테르" }),
      name: el("input", { type: "text", maxlength: "120" }),
      dry: el("input", { type: "text", maxlength: "40", value: saved.dry }),
      lot: el("input", { type: "text", maxlength: "40" }),
      date: el("input", { type: "date", value: today() }),
      keep: el("input", { type: "text", maxlength: "40", value: saved.keep }),
      weight: el("input", { type: "text", maxlength: "40", value: saved.weight }),
      kind: el("input", { type: "text", maxlength: "40", placeholder: "예: 폴리에스테르계" }),
      signal: el("select", {}, [
        el("option", { value: "", text: "없음" }),
        el("option", { value: "위험", text: "위험" }),
        el("option", { value: "경고", text: "경고" })
      ]),
      copies: el("input", { type: "number", min: "1", max: "500", value: "1" }),
      dpi: el("select", {}, [
        el("option", { value: "203", text: "203 dpi (8 dots/mm)" }),
        el("option", { value: "300", text: "300 dpi (12 dots/mm)" })
      ]),
      rotate: el("input", { type: "checkbox" }),
      h: el("textarea", { rows: "4", maxlength: "3000" }),
      p: el("textarea", { rows: "10", maxlength: "6000" }),
      showCodes: el("input", { type: "checkbox" }),
      notice: el("input", { type: "text", maxlength: "200", value: saved.notice }),
      supplier: el("input", { type: "text", maxlength: "300", value: saved.supplier })
    };
    f.lot.value = suggestLot(f.date.value);
    f.dpi.value = saved.dpi;
    f.rotate.checked = !!saved.rotate;
    f.showCodes.checked = !!saved.showCodes;
    var fitWarn = el("p", { class: "a-msg is-error", hidden: true, text: "문구가 길어 라벨 칸을 넘칩니다. 가장 작은 글씨로도 잘리니 [예방조치문구]에서 덜 중요한 줄을 지워 주세요." });

    var ghsBoxes = {};
    var ghsPick = el("div", { class: "lb-ghs-pick" }, GHS_CODES.map(function (c) {
      var box = el("input", { type: "checkbox", value: c, onchange: draw });
      ghsBoxes[c] = box;
      return el("label", { class: "lb-ghs-opt", title: c + " " + GHS_NAME[c] }, [box, el("img", { src: "ghs/" + c + ".svg", alt: "" }), el("span", { text: GHS_NAME[c] })]);
    }));

    var preview = el("div", { class: "lb-preview" });
    var printBtn = el("button", { class: "a-btn", type: "button", text: "인쇄", onclick: onPrint });
    var zplBtn = el("button", { class: "a-btn a-btn--ghost", type: "button", text: "ZPL 파일 저장", onclick: onZpl });

    function field(label, input, hint) {
      return el("label", { class: "a-field" }, [label, hint ? el("small", { text: hint }) : null, input]);
    }

    main.replaceChildren(
      el("h1", { text: "라벨 출력" }),
      el("p", { class: "panel-lede", text: "품명을 입력해 등록된 MSDS를 고르면 제품코드·품명과 MSDS의 그림문자·신호어·종류·유해위험문구·예방조치문구를 불러옵니다. 라벨 크기 가로 130mm × 세로 150mm (Zebra ZT421)." }),
      el("div", { class: "lb-grid" }, [
        el("div", { class: "lb-col" }, [
          el("section", { class: "a-card" }, [
            el("h2", { text: "1. MSDS에서 제품 찾기" }),
            field("품명 · 제품코드", search),
            results,
            hazMsg
          ]),
          el("section", { class: "a-card" }, [
            el("h2", { text: "2. 라벨 내용" }),
            el("div", { class: "lb-form-grid" }, [
              field("제품코드", f.code),
              field("수지 (괄호 안 표기)", f.resin),
              el("div", { class: "lb-span" }, [field("품명 (가운데 큰 글씨)", f.name)]),
              field("건조조건", f.dry),
              field("제조번호", f.lot, "DYP + 연월 + 일련번호"),
              field("제조일자", f.date),
              field("저장기간", f.keep),
              field("실중량", f.weight),
              field("종류", f.kind),
              field("신호어", f.signal)
            ]),
            el("div", { class: "a-field" }, ["그림문자", el("small", { text: "MSDS에서 불러온 그림문자가 체크됩니다. 필요하면 직접 바꿀 수 있습니다." }), ghsPick])
          ]),
          el("section", { class: "a-card" }, [
            el("h2", { text: "3. 유해·위험문구 · 예방조치문구" }),
            el("p", { class: "a-hint", text: "MSDS 2번 항목의 문구를 한 줄에 하나씩 불러옵니다. 라벨 칸에 다 들어가도록 글씨가 자동으로 작아집니다. 너무 작으면 덜 중요한 줄을 지워 주세요." }),
            field("유해·위험문구", f.h, "한 줄에 하나 · 라벨에는 ' / '로 이어서 표시"),
            field("예방조치문구", f.p, "한 줄에 하나 · 라벨에는 '·' 목록으로 표시"),
            el("label", { class: "a-check" }, [f.showCodes, "문구 앞 코드(H351, P280 등)도 라벨에 표시"]),
            field("하단 안내 문구", f.notice),
            field("공급원", f.supplier, "MSDS 1번 항목의 회사명·주소·전화번호")
          ])
        ]),
        el("div", { class: "lb-col" }, [
          el("section", { class: "a-card lb-sticky" }, [
            el("h2", { text: "4. 미리보기 · 출력" }),
            el("div", { class: "lb-preview-wrap" }, [preview]),
            fitWarn,
            el("div", { class: "lb-form-grid" }, [
              field("매수", f.copies),
              field("프린터 해상도 (ZPL)", f.dpi, "ZT421 뒷면 라벨에서 확인"),
              el("label", { class: "a-check lb-span" }, [f.rotate, "ZPL을 90° 돌려서 출력 (라벨이 세로로 들어갈 때)"])
            ]),
            el("div", { class: "a-row" }, [printBtn, zplBtn]),
            el("p", { class: "a-hint", text: "[인쇄] Windows 프린터 목록에서 ZDesigner ZT421을 고르고, 드라이버의 용지(라벨) 크기를 130 × 150mm, 여백 없음, 배율 100%로 맞춰 주세요. " +
              "[ZPL 파일 저장] 라벨을 그림으로 바꾼 ZPL을 저장합니다. Zebra Setup Utilities의 [파일 보내기]나 프린터 웹 화면(Directories → 파일 보내기)으로 보내면 드라이버 설정과 관계없이 정확한 크기로 찍힙니다." }),
            msg
          ])
        ])
      ])
    );

    function lines(text) {
      return String(text).split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    }

    function data() {
      return {
        code: f.code.value.trim(),
        resin: f.resin.value.trim(),
        name: f.name.value.trim(),
        dry: f.dry.value.trim(),
        lot: f.lot.value.trim(),
        date: f.date.value,
        keep: f.keep.value.trim(),
        weight: f.weight.value.trim(),
        kind: f.kind.value.trim(),
        signal: f.signal.value,
        h: lines(f.h.value),
        p: lines(f.p.value),
        showCodes: f.showCodes.checked,
        notice: f.notice.value.trim(),
        supplier: f.supplier.value.trim(),
        pictos: GHS_CODES.filter(function (c) { return ghsBoxes[c].checked; })
      };
    }

    function draw() {
      preview.innerHTML = buildLabelHtml(data(), ghsSrc);
      var label = preview.querySelector(".lb-label");
      imagesReady(label).then(function () { fitWarn.hidden = !fitText(label); });
      fitWarn.hidden = !fitText(label);
    }

    Object.keys(f).forEach(function (k) {
      f[k].addEventListener("input", draw);
      f[k].addEventListener("change", draw);
    });
    f.date.addEventListener("change", function () {
      if (!f.lot.dataset.touched) {
        f.lot.value = suggestLot(f.date.value);
        draw();
      }
    });
    f.lot.addEventListener("input", function () { f.lot.dataset.touched = "1"; });

    function remember() {
      writeJson(SETTINGS_KEY, {
        dry: f.dry.value.trim(),
        keep: f.keep.value.trim(),
        weight: f.weight.value.trim(),
        dpi: f.dpi.value,
        rotate: f.rotate.checked,
        showCodes: f.showCodes.checked,
        notice: f.notice.value.trim(),
        supplier: f.supplier.value.trim()
      });
      if (/^DYP\d{4}\d+$/.test(f.lot.value.trim())) {
        writeJson(LOT_KEY, f.lot.value.trim());
      }
    }

    function check() {
      var d = data();
      if (!d.code || !d.name) {
        setMsg(msg, "제품코드와 품명을 입력해 주세요.", "error");
        return null;
      }
      var n = Math.round(Number(f.copies.value));
      if (!(n >= 1 && n <= 500)) {
        setMsg(msg, "매수는 1~500 사이로 입력해 주세요.", "error");
        return null;
      }
      if (current && !d.pictos.length && current.pictos && current.pictos.length) {
        if (!confirm("MSDS에는 그림문자가 있는데 모두 해제되어 있습니다. 그대로 출력할까요?")) {
          return null;
        }
      }
      return { d: d, n: n };
    }

    async function onPrint() {
      var c = check();
      if (!c) {
        return;
      }
      setMsg(msg, "인쇄 창을 여는 중...");
      await printLabels(c.d, ghsSrc, c.n);
      remember();
      setMsg(msg, "인쇄 창을 열었습니다. 다음 제조번호를 쓰려면 [제조번호]를 확인해 주세요.", "ok");
    }

    async function onZpl() {
      var c = check();
      if (!c) {
        return;
      }
      zplBtn.disabled = true;
      setMsg(msg, "ZPL 파일을 만드는 중...");
      try {
        var canvas = await labelCanvas(c.d, ghsSrc, Number(f.dpi.value), f.rotate.checked);
        var name = (c.d.code + " " + c.d.lot).replace(/[\\/:*?"<>|#]+/g, "_").trim() + ".zpl";
        saveFile(canvasToZpl(canvas, c.n), name);
        remember();
        setMsg(msg, "ZPL 파일을 저장했습니다: " + name + " (" + canvas.width + "×" + canvas.height + " dots, " + c.n + "매)", "ok");
      } catch (err) {
        setMsg(msg, "ZPL 파일을 만들지 못했습니다: " + (err && err.message || err), "error");
      } finally {
        zplBtn.disabled = false;
      }
    }

    // ---------- MSDS 목록·검색 ----------
    function norm(s) {
      return String(s || "").toLowerCase().replace(/[\s#\-_]+/g, "");
    }

    function drawResults() {
      var q = norm(search.value);
      results.replaceChildren();
      if (!q) {
        return;
      }
      var hits = rows.filter(function (r) {
        return norm(r.product_name || r.title).indexOf(q) >= 0 || norm(r.product_code).indexOf(q) >= 0;
      }).slice(0, 12);
      if (!hits.length) {
        results.appendChild(el("li", { class: "a-empty", text: "일치하는 MSDS가 없습니다. MSDS 탭에서 먼저 등록하거나 아래 칸에 직접 입력해 주세요." }));
        return;
      }
      hits.forEach(function (r) {
        results.appendChild(el("li", {}, [el("button", {
          type: "button",
          class: "lb-hit" + (current && current.id === r.id ? " is-on" : ""),
          onclick: function () { pick(r); }
        }, [el("b", { text: r.product_code || "-" }), el("span", { text: r.product_name || r.title || "" })])]));
      });
    }

    search.addEventListener("input", drawResults);
    search.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var first = results.querySelector(".lb-hit");
        if (first) {
          first.click();
        }
      }
    });

    async function pick(r) {
      var seq = ++loadSeq;
      current = r;
      f.code.value = r.product_code || "";
      f.name.value = r.product_name || r.title || "";
      GHS_CODES.forEach(function (c) { ghsBoxes[c].checked = false; });
      f.signal.value = "";
      f.h.value = "";
      f.p.value = "";
      drawResults();
      draw();
      setMsg(hazMsg, "MSDS에서 그림문자를 읽는 중...");
      try {
        var info = await readHazard(sb, r, archiveBy[r.id]);
        if (seq !== loadSeq) {
          return;
        }
        r.pictos = info.pictos;
        info.pictos.forEach(function (c) { ghsBoxes[c].checked = true; });
        f.signal.value = info.signal === "위험" || info.signal === "경고" ? info.signal : "";
        if (info.resin) {
          f.resin.value = info.resin;
          f.kind.value = info.kind;
        }
        f.h.value = info.h.join("\n");
        f.p.value = info.p.join("\n");
        if (info.supplier) {
          f.supplier.value = info.supplier;
        }
        draw();
        setMsg(hazMsg, (info.source + "에서 불러옴 · ") +
          (info.pictos.length ? "그림문자 " + info.pictos.map(function (c) { return GHS_NAME[c]; }).join(", ") : "그림문자 없음") +
          (info.signal ? " · 신호어 " + info.signal : "") +
          (info.codes.length ? " · " + info.codes.join(" ") : "") +
          " · 유해·위험문구 " + info.h.length + "줄, 예방조치문구 " + info.p.length + "줄", info.pictos.length || info.codes.length ? "ok" : null);
      } catch (err) {
        if (seq !== loadSeq) {
          return;
        }
        setMsg(hazMsg, "MSDS 내용을 읽지 못했습니다 (" + (err && err.message || err) + "). 그림문자를 직접 체크해 주세요.", "error");
      }
    }

    draw();
    setMsg(hazMsg, "MSDS 목록을 불러오는 중...");
    var res = await Promise.all([
      sb.from("resources").select("id, title, product_code, product_name, file_path, file_type").eq("category", "msds").order("product_code", { ascending: true }),
      sb.from("msds_archive").select("resource_id, archive_path, file_type, created_at").order("created_at", { ascending: true }),
      window.DY_MSDS_FRM ? window.DY_MSDS_FRM.loadAssets() : Promise.resolve({ ghs: {} })
    ]);
    if (res[0].error) {
      setMsg(hazMsg, "MSDS 목록을 불러오지 못했습니다. 제품 정보를 직접 입력해 주세요.", "error");
      return;
    }
    rows = res[0].data;
    (res[1].data || []).forEach(function (a) {
      if (a.resource_id) {
        (archiveBy[a.resource_id] = archiveBy[a.resource_id] || []).push(a);
      }
    });
    ghsSrc = (res[2] && res[2].ghs) || {};
    setMsg(hazMsg, "등록된 MSDS " + rows.length + "개에서 찾습니다.");
    draw();
  };
})();
