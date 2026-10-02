// 관리자에서 MSDS 정보를 수정하면 엑셀 파일 안의 같은 값(품명·제품코드·MSDS NO·최종개정일자)도 바꾼다.
// window.DY_MSDS_REWRITE(bytes, XLSX, before, after) → { bytes, mode, changed, missing, lossy }
//  - before: 파일에서 읽은 현재 값 (DY_MSDS_EXTRACT 결과), after: 바꿀 값
//  - mode "html": 웹 표 형식 .xls → 글자만 바꿔 서식 그대로 유지
//  - mode "xlsx": .xlsx → 내부 XML의 값만 바꿔 서식 그대로 유지
//  - mode "xls": 옛 엑셀(이진) .xls → 다시 저장하므로 글꼴·색 같은 서식이 단순해질 수 있음 (lossy)
(function (root) {
  var FIELDS = { name: "품명", code: "제품코드", msdsNo: "MSDS NO", revised: "개정일" };
  var LABEL_REVISED = /최종\s*개정\s*일자?|최종\s*개정일|(?:Last\s*)?Revision\s*date/i;

  function escapeXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function countAndReplace(text, from, to) {
    if (!from || text.indexOf(from) === -1) {
      return { text: text, n: 0 };
    }
    var parts = text.split(from);
    return { text: parts.join(to), n: parts.length - 1 };
  }

  // "2026-01-06" → 파일에 쓰였을 법한 날짜 표기들
  function dateForms(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      return [];
    }
    var y = m[1], mo = m[2], d = m[3];
    return [y + "-" + mo + "-" + d, y + "." + mo + "." + d, y + "/" + mo + "/" + d, y + ". " + mo + ". " + d,
      y + "년 " + mo + "월 " + d + "일", y + "년 " + Number(mo) + "월 " + Number(d) + "일"];
  }

  function serial(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000 : null;
  }

  // 바꿀 글자 쌍 (긴 것부터)
  function textPairs(before, after) {
    var pairs = [];
    ["msdsNo", "code", "name"].forEach(function (k) {
      if (before[k] && after[k] && before[k] !== after[k]) {
        pairs.push([before[k], after[k]]);
      }
    });
    if (before.revised && after.revised && before.revised !== after.revised) {
      var oldForms = dateForms(before.revised);
      var newForms = dateForms(after.revised);
      oldForms.forEach(function (f, i) {
        pairs.push([f, newForms[i]]);
      });
    }
    return pairs.sort(function (a, b) { return b[0].length - a[0].length; });
  }

  function missingFields(before, after) {
    return Object.keys(FIELDS).filter(function (k) {
      return after[k] && !before[k];
    }).map(function (k) { return FIELDS[k]; });
  }

  // 시트에서 "최종개정일자" 라벨 오른쪽 첫 값 칸의 주소
  function revisedCellAddress(ws, XLSX) {
    if (!ws || !ws["!ref"]) {
      return null;
    }
    var range = XLSX.utils.decode_range(ws["!ref"]);
    for (var r = range.s.r; r <= range.e.r; r++) {
      for (var c = range.s.c; c <= range.e.c; c++) {
        var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        if (cell && typeof cell.v === "string" && LABEL_REVISED.test(cell.v)) {
          for (var c2 = c + 1; c2 <= range.e.c; c2++) {
            var addr = XLSX.utils.encode_cell({ r: r, c: c2 });
            var v = ws[addr];
            if (v && v.v !== "" && v.v !== null && v.v !== undefined) {
              return addr;
            }
          }
        }
      }
    }
    return null;
  }

  function sniff(bytes) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return "xlsx";
    }
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
      return "xls";
    }
    return "html";
  }

  function rewriteHtml(bytes, before, after) {
    var head = "";
    for (var i = 0; i < Math.min(bytes.length, 4096); i++) {
      head += String.fromCharCode(bytes[i]);
    }
    var cs = (head.match(/charset\s*=\s*["']?([\w-]+)/i) || [, "utf-8"])[1].toLowerCase();
    var text;
    try {
      text = new TextDecoder(cs).decode(bytes);
    } catch (e) {
      text = new TextDecoder("utf-8").decode(bytes);
    }
    var changed = 0;
    textPairs(before, after).forEach(function (p) {
      var r1 = countAndReplace(text, p[0], escapeXml(p[1]));
      text = r1.text;
      changed += r1.n;
      if (escapeXml(p[0]) !== p[0]) {
        var r2 = countAndReplace(text, escapeXml(p[0]), escapeXml(p[1]));
        text = r2.text;
        changed += r2.n;
      }
    });
    // 다시 저장할 때는 UTF-8로 쓰므로 문서의 문자 집합 표시도 맞춘다.
    text = text.replace(/(charset\s*=\s*["']?)[\w-]+/i, "$1utf-8");
    return { bytes: new TextEncoder().encode(text), changed: changed };
  }

  function rewriteXlsx(bytes, XLSX, before, after) {
    var CFB = XLSX.CFB;
    var zip = CFB.read(bytes, { type: "array" });
    var wb = XLSX.read(bytes, { type: "array", cellDates: false });
    var pairs = textPairs(before, after);
    var changed = 0;
    var dec = new TextDecoder("utf-8");
    var enc = new TextEncoder();

    zip.FullPaths.forEach(function (path, i) {
      if (!/xl\/(sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(path)) {
        return;
      }
      var entry = zip.FileIndex[i];
      var xml = dec.decode(entry.content);
      var before0 = xml;
      pairs.forEach(function (p) {
        var r = countAndReplace(xml, escapeXml(p[0]), escapeXml(p[1]));
        xml = r.text;
        changed += r.n;
      });
      // 날짜가 숫자(엑셀 날짜)로 저장된 칸
      var sheetMatch = path.match(/worksheets\/sheet(\d+)\.xml$/);
      var oldSerial = serial(before.revised);
      var newSerial = serial(after.revised);
      if (sheetMatch && oldSerial !== null && newSerial !== null && oldSerial !== newSerial) {
        var ws = wb.Sheets[wb.SheetNames[Number(sheetMatch[1]) - 1]];
        var addr = revisedCellAddress(ws, XLSX);
        if (addr) {
          var re = new RegExp('(<c r="' + addr + '"(?:(?!t="s")[^>])*>(?:<f>[^<]*</f>)?<v>)' + oldSerial + "(</v>)");
          if (re.test(xml)) {
            xml = xml.replace(re, "$1" + newSerial + "$2");
            changed++;
          }
        }
      }
      if (xml !== before0) {
        entry.content = enc.encode(xml);
      }
    });
    return { bytes: new Uint8Array(CFB.write(zip, { type: "array", fileType: "zip" })), changed: changed };
  }

  function rewriteBinaryXls(bytes, XLSX, before, after) {
    var wb = XLSX.read(bytes, { type: "array", cellDates: true, cellStyles: true });
    var pairs = textPairs(before, after);
    var changed = 0;
    var oldSerial = serial(before.revised);
    var newSerial = serial(after.revised);
    wb.SheetNames.forEach(function (name) {
      var ws = wb.Sheets[name];
      var revAddr = revisedCellAddress(ws, XLSX);
      Object.keys(ws).forEach(function (addr) {
        if (addr.charAt(0) === "!") {
          return;
        }
        var cell = ws[addr];
        if (cell.t === "s" && typeof cell.v === "string") {
          var v = cell.v;
          pairs.forEach(function (p) {
            var r = countAndReplace(v, p[0], p[1]);
            v = r.text;
            changed += r.n;
          });
          if (v !== cell.v) {
            cell.v = v;
            delete cell.w;
            delete cell.h;
            delete cell.r;
          }
        } else if (addr === revAddr && newSerial !== null && oldSerial !== newSerial) {
          var isDate = cell.t === "d" || (cell.t === "n" && Math.round(cell.v) === oldSerial);
          if (isDate) {
            ws[addr] = { t: "n", v: newSerial, z: "yyyy-mm-dd" };
            changed++;
          }
        }
      });
    });
    return { bytes: new Uint8Array(XLSX.write(wb, { type: "array", bookType: "biff8" })), changed: changed };
  }

  root.DY_MSDS_FORMAT = function (bytes) {
    return sniff(bytes);
  };

  root.DY_MSDS_REWRITE = function (bytes, XLSX, before, after) {
    var mode = sniff(bytes);
    var result = mode === "xlsx" ? rewriteXlsx(bytes, XLSX, before, after)
      : mode === "xls" ? rewriteBinaryXls(bytes, XLSX, before, after)
        : rewriteHtml(bytes, before, after);
    result.mode = mode;
    result.lossy = mode === "xls";
    result.missing = missingFields(before, after);
    result.wanted = textPairs(before, after).length > 0;
    return result;
  };
})(typeof window !== "undefined" ? window : globalThis);
