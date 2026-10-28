// 관리자 패널 [라벨 출력]: 등록된 MSDS에서 라벨 내용을 읽는 부분 (화면·출력은 label-print.js)
//  - MSDS 읽는 순서: 원본 보관함의 엑셀 → 홈페이지에 걸린 엑셀 → PDF 글자
//  - 읽은 내용은 label_products 표에 저장해 재고관리 앱의 [라벨 출력]에서도 쓴다 (supabase/label_products.sql)
(function () {
  function ext(path) {
    return (String(path || "").match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
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

  function infoFromModel(model) {
    var out = { codes: [], signal: "", usage: "", h: [], p: [], supplierName: "", tel: "" };
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
    out.supplierName = sup.name || "";
    out.tel = sup.tel || "";
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
      supplierName: pick(/회사\s*명\s*[:：]?\s*([^\n]+)/),
      tel: pick(/긴급\s*전화\s*번호\s*[:：]?\s*([^\n]+)/)
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

  // 한 제품의 MSDS에서 { pictos, codes, signal, kind, resin, h, p, supplierName, tel, source } 를 읽는다.
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
          h: window.DY_LABEL_PRINT.sortHazards(info.h),
          p: info.p,
          supplierName: info.supplierName,
          tel: info.tel,
          source: t.label
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("읽을 수 있는 MSDS 파일이 없습니다");
  }

  function missingTable(err) {
    return err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|schema cache/i.test(err.message || ""));
  }

  // 라벨용 정보 저장 (재고관리 앱이 읽는 표)
  async function saveLabelInfo(sb, row, info) {
    if (!row.product_code) {
      return "제품코드가 없어 라벨용 정보는 저장하지 않았습니다.";
    }
    var res = await sb.from("label_products").upsert({
      product_code: row.product_code,
      product_name: row.product_name || row.title || "",
      resin: info.resin || "",
      kind: info.kind || "",
      pictos: info.pictos,
      signal: info.signal || "",
      codes: info.codes,
      h: info.h,
      p: info.p,
      supplier_name: info.supplierName || "",
      supplier_tel: info.tel || "",
      source: info.source || "",
      updated_at: new Date().toISOString()
    }, { onConflict: "product_code" });
    if (res.error) {
      throw new Error(missingTable(res.error)
        ? "라벨용 정보 표가 아직 없습니다. Supabase SQL Editor에서 supabase/label_products.sql을 한 번 실행해 주세요."
        : res.error.message);
    }
    return "라벨용 정보 저장됨 (재고관리 앱에서도 사용)";
  }

  // [라벨 출력] 화면에 넘기는 자료 출처: 등록된 MSDS
  window.DY_LABEL_MSDS_SOURCE = function (sb) {
    var archiveBy = {};
    var rows = [];
    return {
      lede: "품명을 입력해 등록된 MSDS를 고르면 제품코드·품명과 MSDS의 그림문자·신호어·종류·유해위험문구·예방조치문구를 불러옵니다. 불러온 내용은 재고관리 앱의 [라벨 출력]에서도 쓸 수 있게 저장됩니다. 라벨 크기 가로 130mm × 세로 100mm (Zebra ZT421).",
      searchTitle: "1. MSDS에서 제품 찾기",
      emptyText: "일치하는 MSDS가 없습니다. MSDS 탭에서 먼저 등록하거나 아래 칸에 직접 입력해 주세요.",
      list: async function () {
        var res = await Promise.all([
          sb.from("resources").select("id, title, product_code, product_name, file_path, file_type").eq("category", "msds").order("product_code", { ascending: true }),
          sb.from("msds_archive").select("resource_id, archive_path, file_type, created_at").order("created_at", { ascending: true })
        ]);
        if (res[0].error) {
          throw new Error(res[0].error.message);
        }
        (res[1].data || []).forEach(function (a) {
          if (a.resource_id) {
            (archiveBy[a.resource_id] = archiveBy[a.resource_id] || []).push(a);
          }
        });
        rows = res[0].data.map(function (r) {
          return Object.assign({}, r, { key: r.id, product_name: r.product_name || r.title || "" });
        });
        return rows;
      },
      load: function (row) {
        return readHazard(sb, row, archiveBy[row.id]);
      },
      afterLoad: function (row, info) {
        return saveLabelInfo(sb, row, info);
      },
      // 1번 칸 아래 [전체 저장] 버튼: 등록된 MSDS를 모두 읽어 라벨용 정보로 저장
      extra: function (ui) {
        var btn = ui.el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "등록된 MSDS 전체를 라벨용 정보로 저장" });
        var note = ui.el("p", { class: "a-msg", role: "status" });
        btn.addEventListener("click", async function () {
          if (!rows.length || !confirm("등록된 MSDS " + rows.length + "개를 모두 읽어 라벨용 정보로 저장할까요?\n재고관리 앱의 [라벨 출력]에서 이 정보를 씁니다. 몇 분 걸릴 수 있습니다.")) {
            return;
          }
          btn.disabled = true;
          var ok = 0;
          var failed = [];
          for (var i = 0; i < rows.length; i++) {
            ui.setMsg(note, "저장하는 중... " + (i + 1) + " / " + rows.length);
            try {
              await saveLabelInfo(sb, rows[i], await readHazard(sb, rows[i], archiveBy[rows[i].id]));
              ok++;
            } catch (err) {
              failed.push((rows[i].product_code || rows[i].product_name) + " (" + (err && err.message || err) + ")");
              if (/label_products\.sql/.test(String(err && err.message))) {
                break;
              }
            }
          }
          btn.disabled = false;
          ui.setMsg(note, ok + "개 저장" + (failed.length ? " · 실패 " + failed.length + "개: " + failed.slice(0, 5).join(", ") + (failed.length > 5 ? " …" : "") : ""), failed.length ? "error" : "ok");
        });
        return [ui.el("div", { class: "a-row" }, [btn]), note];
      }
    };
  };
})();
