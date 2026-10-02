// MSDS 엑셀 파일(KOSHA 양식 등)에서 품명·제품코드·MSDS NO·최종개정일자를 읽는다.
// 브라우저에서는 window.DY_MSDS_PARSE(file) → Promise<{ name, code, msdsNo, revised }>
(function (root) {
  function text(v) {
    if (v === null || v === undefined) {
      return "";
    }
    if (v instanceof Date) {
      return isoDate(v);
    }
    return String(v).replace(/\s+/g, " ").trim();
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // 날짜 셀: Date 객체, 엑셀 날짜 숫자, "2026-01-06" / "2026.01.06" / "2026년 1월 6일" 같은 글자
  function toDate(v, XLSX) {
    if (v instanceof Date && !isNaN(v)) {
      return isoDate(v);
    }
    if (typeof v === "number" && XLSX && XLSX.SSF && v > 20000 && v < 80000) {
      var p = XLSX.SSF.parse_date_code(v);
      if (p) {
        return p.y + "-" + pad(p.m) + "-" + pad(p.d);
      }
    }
    var m = text(v).match(/(20\d{2}|19\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
    return m ? m[1] + "-" + pad(m[2]) + "-" + pad(m[3]) : "";
  }

  // 표의 한 줄에서 라벨 칸 다음에 오는 첫 번째 값
  function valueAfter(row, index) {
    for (var i = index + 1; i < row.length; i++) {
      if (text(row[i])) {
        return row[i];
      }
    }
    return "";
  }

  // 같은 칸에 "MSDS NO. : AA..."처럼 붙어 있는 경우
  function inlineValue(cell, labelRe) {
    var rest = text(cell).replace(labelRe, "").replace(/^[\s:.：\-]+/, "");
    return rest;
  }

  var LABEL_MSDS_NO = /MSDS\s*N[Oo]\.?|MSDS\s*번호/;
  var LABEL_REVISED = /최종\s*개정\s*일자?|최종\s*개정일|(?:Last\s*)?Revision\s*date/i;
  var LABEL_NAME = /^(?:가\.\s*)?제품\s*명|^(?:가\.\s*)?제품의?\s*명칭|^Product\s*name|^품\s*명$/i;
  var CODE_IN_PARENS = /^(.*?)\s*[(（]\s*([A-Za-z0-9#\-_./ ]*\d[A-Za-z0-9#\-_./ ]*)\s*[)）]\s*$/;
  var MSDS_NO_SHAPE = /\b([A-Z]{1,4}\d{3,8}-\d{4,14})\b/;

  function splitNameCode(value) {
    var t = text(value);
    var m = t.match(CODE_IN_PARENS);
    if (m && m[1]) {
      return { name: m[1].trim(), code: m[2].trim() };
    }
    return { name: t, code: "" };
  }

  function extract(rows, XLSX) {
    var out = { name: "", code: "", msdsNo: "", revised: "" };
    var nameCandidates = [];

    rows.forEach(function (row) {
      row.forEach(function (cell, i) {
        var t = text(cell);
        if (!t) {
          return;
        }
        if (!out.msdsNo && LABEL_MSDS_NO.test(t)) {
          var no = inlineValue(cell, LABEL_MSDS_NO) || text(valueAfter(row, i));
          var shaped = no.match(MSDS_NO_SHAPE);
          out.msdsNo = shaped ? shaped[1] : no;
        }
        if (!out.revised && LABEL_REVISED.test(t)) {
          out.revised = toDate(inlineValue(cell, LABEL_REVISED), XLSX) || toDate(valueAfter(row, i), XLSX);
        }
        if (LABEL_NAME.test(t)) {
          var v = inlineValue(cell, LABEL_NAME) || text(valueAfter(row, i));
          if (v) {
            nameCandidates.unshift(v);
          }
        }
        // "내장형 1010 IVORY 유광 (DY#1-IV064)" 처럼 이름(코드) 모양인 칸
        if (CODE_IN_PARENS.test(t) && t.length <= 120 && !/[:：]/.test(t)) {
          nameCandidates.push(t);
        }
      });
    });

    // 라벨 근처 값 → 이름(코드) 모양 값 순으로, 코드가 들어 있는 것을 우선
    var withCode = nameCandidates.map(splitNameCode).filter(function (c) { return c.code; });
    var picked = withCode[0] || (nameCandidates[0] ? splitNameCode(nameCandidates[0]) : null);
    if (picked) {
      out.name = picked.name;
      out.code = picked.code;
    }

    if (!out.msdsNo) {
      for (var r = 0; r < rows.length && !out.msdsNo; r++) {
        var joined = rows[r].map(text).join(" ");
        var m = joined.match(MSDS_NO_SHAPE);
        if (m) {
          out.msdsNo = m[1];
        }
      }
    }
    return out;
  }

  function parseWorkbook(wb, XLSX) {
    var best = { name: "", code: "", msdsNo: "", revised: "" };
    wb.SheetNames.some(function (sheetName) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: "" });
      var got = extract(rows, XLSX);
      Object.keys(best).forEach(function (k) {
        if (!best[k] && got[k]) {
          best[k] = got[k];
        }
      });
      return best.name && best.code && best.msdsNo && best.revised;
    });
    return best;
  }

  root.DY_MSDS_EXTRACT = function (buffer, XLSX) {
    var wb = XLSX.read(buffer, { type: "array", cellDates: true });
    return parseWorkbook(wb, XLSX);
  };

  // ---------- PDF ----------
  // PDF는 정해진 칸이 없어서 글자를 읽어 찾는다: MSDS NO(예: AA14944-0000000001), "제품명" 줄의 품명(코드).
  // 개정일은 PDF에 명확히 없으므로 정해진 날짜로 채운다.
  root.DY_MSDS_PDF_REVISED = "2026-01-05";

  function linesFromItems(items) {
    var sorted = items.filter(function (it) { return it.str && it.str.trim(); }).sort(function (a, b) {
      return Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x;
    });
    var lines = [];
    var cur = null;
    sorted.forEach(function (it) {
      if (!cur || Math.abs(cur.y - it.y) > 3) {
        cur = { y: it.y, text: "", end: null };
        lines.push(cur);
      }
      var gap = cur.end === null ? 0 : it.x - cur.end;
      cur.text += (cur.end !== null && gap > Math.max(1.5, it.h * 0.25) ? " " : "") + it.str;
      cur.end = it.x + it.w;
    });
    return lines.map(function (l) { return l.text.replace(/\s+/g, " ").trim(); });
  }

  function extractFromPdfText(lines) {
    var out = { name: "", code: "", msdsNo: "", revised: root.DY_MSDS_PDF_REVISED };
    var all = lines.join("\n");
    var no = all.match(MSDS_NO_SHAPE);
    if (no) {
      out.msdsNo = no[1];
    }
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/제\s*품\s*명\s*[:：]?\s*(.*)$/);
      if (!m) {
        continue;
      }
      var value = m[1].trim() || (lines[i + 1] || "").trim();
      if (value) {
        var split = splitNameCode(value.replace(/\s*([(（])\s*/, "$1"));
        out.name = split.name;
        out.code = split.code;
        break;
      }
    }
    return out;
  }

  root.DY_MSDS_PARSE_PDF = function (file) {
    var pdfjs = root.pdfjsLib;
    if (!pdfjs) {
      return Promise.reject(new Error("PDF 읽기 도구를 불러오지 못했습니다."));
    }
    return file.arrayBuffer().then(function (buf) {
      return pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
    }).then(async function (doc) {
      var lines = [];
      var pages = Math.min(doc.numPages, 2);
      for (var n = 1; n <= pages; n++) {
        var page = await doc.getPage(n);
        var content = await page.getTextContent();
        lines = lines.concat(linesFromItems(content.items.map(function (it) {
          return { str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 10 };
        })));
        // 빨간 글씨 메모(주석)로 들어간 MSDS NO도 읽는다
        var annots = await page.getAnnotations();
        annots.forEach(function (a) {
          var t = (a.contentsObj && a.contentsObj.str) || a.contents || "";
          if (t) {
            lines.push(String(t));
          }
        });
      }
      doc.destroy();
      return extractFromPdfText(lines);
    });
  };

  root.DY_MSDS_PARSE = function (file) {
    var XLSX = root.XLSX;
    if (!XLSX) {
      return Promise.reject(new Error("엑셀 읽기 도구를 불러오지 못했습니다."));
    }
    return file.arrayBuffer().then(function (buf) {
      return root.DY_MSDS_EXTRACT(new Uint8Array(buf), XLSX);
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
