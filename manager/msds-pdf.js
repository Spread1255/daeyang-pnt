// 엑셀 MSDS(.xls/.xlsx, 웹 표 형식 .xls 포함)를 A4 PDF로 바꾼다. (관리자 브라우저에서 실행)
// window.DY_MSDS_TO_PDF(bytes, XLSX) → Promise<Blob>
//  - 웹 표 형식 .xls: 파일 속 HTML을 그대로 그린다 (서식 유지)
//  - 엑셀 형식 .xls/.xlsx: 표(병합·열 너비·배경색)를 다시 그린다 (글꼴·그림은 단순해질 수 있음)
//  - 표의 행 경계에서 쪽을 나눠 행이 잘리지 않게 한다
(function (root) {
  var PAGE_W_MM = 210;
  var PAGE_H_MM = 297;
  var MARGIN_MM = 8;
  var MIN_WIDTH_PX = 794; // A4 폭(96dpi)

  var BASE_CSS =
    "html,body{margin:0;padding:0;background:#fff;color:#000;}" +
    "body{font-family:'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo','Noto Sans KR',sans-serif;font-size:12px;padding:8px;}" +
    "img{max-width:100%;}";

  var SHEET_CSS =
    "table{border-collapse:collapse;margin:0 0 16px;}" +
    "td,th{border:1px solid #777;padding:3px 5px;vertical-align:middle;font-size:12px;line-height:1.35;white-space:pre-wrap;word-break:keep-all;}" +
    "h2{font-size:14px;margin:12px 0 6px;}";

  function decodeHtml(bytes) {
    var head = "";
    for (var i = 0; i < Math.min(bytes.length, 4096); i++) {
      head += String.fromCharCode(bytes[i]);
    }
    var cs = (head.match(/charset\s*=\s*["']?([\w-]+)/i) || [, "utf-8"])[1].toLowerCase();
    try {
      return new TextDecoder(cs).decode(bytes);
    } catch (e) {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 엑셀 형식 파일 → HTML (시트마다 표 하나)
  function workbookToHtml(bytes, XLSX) {
    var wb = XLSX.read(bytes, { type: "array", cellStyles: true, cellDates: true, dateNF: "yyyy-mm-dd" });
    var parts = [];
    wb.SheetNames.forEach(function (name, si) {
      var ws = wb.Sheets[name];
      if (!ws || !ws["!ref"]) {
        return;
      }
      var prefix = "s" + si;
      var html = XLSX.utils.sheet_to_html(ws, { id: prefix, editable: false, header: "", footer: "" });
      var table = (html.match(/<table[\s\S]*<\/table>/i) || [""])[0];
      if (!table) {
        return;
      }
      // 열 너비
      var cols = ws["!cols"] || [];
      if (cols.length) {
        var colgroup = "<colgroup>" + cols.map(function (c) {
          var px = c && (c.wpx || (c.wch ? c.wch * 7 + 5 : 0) || (c.width ? c.width * 7 : 0));
          return px ? '<col style="width:' + Math.round(px) + 'px">' : "<col>";
        }).join("") + "</colgroup>";
        table = table.replace(/<table([^>]*)>/i, '<table$1 style="table-layout:fixed">' + colgroup);
      }
      // 칸 배경색
      table = table.replace(/<td([^>]*) id="([^"]+)"/g, function (all, attrs, id) {
        var addr = id.slice(prefix.length + 1);
        var cell = ws[addr];
        var fill = cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb;
        if (fill && /^[0-9A-F]{6}$/i.test(fill) && fill.toUpperCase() !== "FFFFFF") {
          return "<td" + attrs + ' id="' + id + '" style="background:#' + fill + '"';
        }
        return all;
      });
      if (wb.SheetNames.length > 1) {
        parts.push("<h2>" + escapeHtml(name) + "</h2>");
      }
      parts.push(table);
    });
    return "<!doctype html><html><head><meta charset=\"utf-8\"><style>" + BASE_CSS + SHEET_CSS + "</style></head><body>" + parts.join("") + "</body></html>";
  }

  // 웹 표 형식 .xls → 그대로 쓰되 스크립트는 빼고 기본 글꼴만 더한다
  function htmlFileToHtml(bytes) {
    var text = decodeHtml(bytes)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<meta[^>]+charset[^>]*>/gi, "");
    var style = "<meta charset=\"utf-8\"><style>" + BASE_CSS + "table{border-collapse:collapse;}</style>";
    if (/<head[^>]*>/i.test(text)) {
      return text.replace(/<head[^>]*>/i, function (h) { return h + style; });
    }
    return "<!doctype html><html><head>" + style + "</head><body>" + text + "</body></html>";
  }

  function renderFrame(html) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      // 파일 속 HTML이 스크립트를 실행하지 못하게 막는다 (그리기용으로 내용만 읽는다).
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:" + MIN_WIDTH_PX + "px;height:1000px;border:0;visibility:hidden;";
      frame.onload = function () {
        var doc = frame.contentDocument;
        var imgs = Array.prototype.slice.call(doc.images);
        Promise.all(imgs.map(function (img) {
          return img.complete ? null : new Promise(function (r) { img.onload = img.onerror = r; });
        })).then(function () {
          return doc.fonts && doc.fonts.ready;
        }).then(function () {
          resolve(frame);
        });
      };
      // 내용을 먼저 넣고 붙여야 빈 문서의 load가 먼저 오지 않는다.
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
  }

  // 행 경계에서 쪽 나누기 (위치는 문서 px 기준)
  function pageCuts(doc, totalH, pageH) {
    var stops = [];
    Array.prototype.forEach.call(doc.querySelectorAll("tr"), function (tr) {
      var r = tr.getBoundingClientRect();
      stops.push(Math.round(r.bottom + doc.defaultView.scrollY));
    });
    stops.sort(function (a, b) { return a - b; });
    var cuts = [0];
    var start = 0;
    while (totalH - start > pageH) {
      var limit = start + pageH;
      var best = 0;
      for (var i = 0; i < stops.length; i++) {
        if (stops[i] > start + pageH * 0.5 && stops[i] <= limit) {
          best = stops[i];
        }
      }
      start = best || limit;
      cuts.push(start);
    }
    cuts.push(totalH);
    return cuts;
  }

  root.DY_MSDS_TO_PDF = async function (bytes, XLSX) {
    if (!root.html2canvas || !root.jspdf) {
      throw new Error("PDF 변환 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    }
    var mode = root.DY_MSDS_FORMAT ? root.DY_MSDS_FORMAT(bytes) : "xls";
    var html = mode === "html" ? htmlFileToHtml(bytes) : workbookToHtml(bytes, XLSX);
    var frame = await renderFrame(html);
    try {
      var doc = frame.contentDocument;
      var body = doc.body;
      // 내용 폭에 맞춰 그린다: 좁은 표는 A4 폭에 맞게 키우고, 넓은 표는 줄인다.
      var right = 0;
      Array.prototype.forEach.call(doc.querySelectorAll("table, img"), function (node) {
        right = Math.max(right, node.getBoundingClientRect().right);
      });
      var width = right && right < MIN_WIDTH_PX
        ? Math.max(560, Math.ceil(right + 8))
        : Math.max(MIN_WIDTH_PX, Math.ceil(body.scrollWidth), Math.ceil(doc.documentElement.scrollWidth));
      frame.style.width = width + "px";
      var totalH = Math.max(Math.ceil(body.scrollHeight), Math.ceil(doc.documentElement.scrollHeight));
      frame.style.height = totalH + "px";
      if (!body.textContent.trim() && !doc.images.length) {
        throw new Error("파일 내용을 읽지 못했습니다.");
      }

      var contentWmm = PAGE_W_MM - MARGIN_MM * 2;
      var contentHmm = PAGE_H_MM - MARGIN_MM * 2;
      var pageHpx = Math.floor(width * contentHmm / contentWmm);
      var cuts = pageCuts(doc, totalH, pageHpx);

      // 캔버스 크기 제한(높이 약 32000px)을 넘지 않게 배율을 정한다
      var scale = Math.min(1.6, 30000 / totalH, 8000 / width);
      var canvas = await root.html2canvas(doc.documentElement, {
        scale: scale,
        width: width,
        height: totalH,
        windowWidth: width,
        windowHeight: totalH,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false
      });

      var pdf = new root.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      var slice = document.createElement("canvas");
      var ctx = slice.getContext("2d");
      for (var p = 0; p < cuts.length - 1; p++) {
        var y0 = Math.round(cuts[p] * scale);
        var y1 = Math.round(cuts[p + 1] * scale);
        var h = Math.max(1, y1 - y0);
        slice.width = canvas.width;
        slice.height = h;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);
        if (p > 0) {
          pdf.addPage();
        }
        var hMm = (h / scale) * contentWmm / width;
        pdf.addImage(slice.toDataURL("image/jpeg", 0.82), "JPEG", MARGIN_MM, MARGIN_MM, contentWmm, hMm, undefined, "FAST");
      }
      return pdf.output("blob");
    } finally {
      frame.remove();
    }
  };
})(window);
