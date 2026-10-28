// 제품 라벨 출력 화면 (가로 130mm × 세로 100mm, Zebra ZT421) — 홈페이지 관리자와 재고관리 앱이 같은 파일을 쓴다.
//  window.DY_LABEL_PRINT(main, source) : main 요소에 화면을 그린다. source가 제품 목록과 라벨 내용(그림문자·문구)을 준다.
//   - 홈페이지 관리자: manager/label-msds.js (등록된 MSDS를 직접 읽음)
//   - 재고관리 앱: label/label-source.js (홈페이지의 label_products 표를 읽음)
//  - 출력: [인쇄] 브라우저 인쇄(ZDesigner 드라이버), [ZPL 저장] 라벨 전체를 그림으로 바꾼 ZPL 파일 (한글 글꼴이 프린터에 없어도 됨)
//  재고관리 앱에는 이 파일을 그대로 복사해 둔다 (spread1255-pocheon-inventory/label/label-print.js). 고치면 두 곳 모두 바꿀 것.
(function () {
  var LABEL_W_MM = 130;
  var LABEL_H_MM = 100;
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
    qr: "https://daeyangpnt.co.kr/msds"
  };
  // 라벨 맨 아래 공급원: 주소는 포천 제2공장으로 고정, 회사명·전화번호는 MSDS 값 (없으면 아래 값)
  var SUPPLIER_NAME = "(주) 대양피앤티";
  var SUPPLIER_ADDR = "경기도 포천시 일동면 화동로 1544-6";
  var SUPPLIER_TEL = "031) 987-8587";
  // 문구 앞 코드: "H351", "P301+P312" 등
  // 라벨에 넣는 예방조치문구 줄 수: 그림문자 1개면 그 그림문자로 3줄, 2개면 앞 그림문자 2줄·뒤 그림문자 1줄
  var P_LINES = 3;
  // 그림문자별로 우선 고를 예방조치문구 (GHS 기준 그 유해성에 해당하는 대표 문구, 앞쪽이 우선)
  var P_BY_GHS = {
    GHS01: ["P210", "P234", "P240", "P250", "P230", "P370+P380", "P372", "P373", "P401"],
    GHS02: ["P210", "P233", "P240", "P241", "P242", "P243", "P370+P378", "P403+P235"],
    GHS03: ["P210", "P220", "P221", "P280", "P370+P378", "P501"],
    GHS04: ["P410+P403", "P410", "P403"],
    GHS05: ["P280", "P260", "P303+P361+P353", "P305+P351+P338", "P301+P330+P331", "P310", "P264", "P363", "P405"],
    GHS06: ["P264", "P270", "P280", "P301+P310", "P302+P352", "P304+P340", "P260", "P310", "P405"],
    GHS07: ["P264", "P280", "P302+P352", "P305+P351+P338", "P270", "P301+P312", "P261", "P304+P340", "P332+P313", "P337+P313", "P362+P364", "P330", "P321"],
    GHS08: ["P201", "P308+P313", "P202", "P260", "P284", "P342+P311", "P301+P310", "P331", "P314", "P405"],
    GHS09: ["P273", "P391", "P501"]
  };
  var STMT_CODE_RE = /^([HP]\d{3}[A-Za-z]?(?:\s*\+\s*[HP]\d{3}[A-Za-z]?)*)\s*[:：]?\s*/;

  var LABEL_CSS =
    ".lb-label{width:" + LABEL_W_MM + "mm;height:" + LABEL_H_MM + "mm;padding:2.5mm;box-sizing:border-box;background:#fff;color:#000;overflow:hidden;" +
    "font-family:'Batang','바탕','BatangChe','Noto Serif KR','Nanum Myeongjo',serif;}" +
    ".lb-label *{box-sizing:border-box;}" +
    ".lb-frame{height:100%;border:0.7mm solid #000;padding:0.6mm;}" +
    ".lb-inner{height:100%;border:0.25mm solid #000;display:flex;flex-direction:column;}" +
    ".lb-head{text-align:center;padding:0.8mm 2mm 0.5mm;}" +
    ".lb-code{font-size:5.5mm;line-height:1.1;white-space:nowrap;letter-spacing:0.2mm;}" +
    ".lb-resin{font-size:2.6mm;line-height:1.2;margin-top:0.2mm;}" +
    ".lb-name{border-top:0.25mm solid #000;border-bottom:0.25mm solid #000;padding:0.6mm 2mm;text-align:center;white-space:nowrap;" +
    "font-family:'HY견명조','HYGyeonMyeongJo','Batang','바탕','Noto Serif KR',serif;font-weight:700;font-size:6.3mm;line-height:1.15;}" +
    ".lb-body{flex:1;display:flex;padding:0.8mm 4mm 0.8mm 8mm;min-height:0;}" +
    // 종류 아래 그림문자 줄: 왼쪽 그림문자 + 신호어, 맨 오른쪽 QR 코드
    ".lb-warn{flex:none;border-top:0.25mm solid #000;display:flex;align-items:center;justify-content:space-between;gap:3mm;padding:0.8mm 4mm;}" +
    ".lb-warn-l{display:flex;align-items:center;gap:3mm;}" +
    ".lb-qr{flex:none;width:13mm;height:13mm;margin-left:auto;}" +
    ".lb-qr img{display:block;width:100%;height:100%;}" +
    ".lb-fields{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;font-size:3.3mm;line-height:1.15;min-width:0;}" +
    ".lb-row{display:flex;align-items:baseline;white-space:nowrap;}" +
    ".lb-key{display:flex;justify-content:space-between;width:15mm;flex:none;}" +
    ".lb-colon{margin:0 3mm 0 2mm;flex:none;}" +
    ".lb-val{overflow:hidden;}" +
    ".lb-no{flex:none;align-self:flex-end;min-width:17mm;text-align:right;white-space:nowrap;font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;font-weight:700;font-size:4mm;line-height:1;padding-bottom:0.3mm;}" +
    ".lb-ghs{display:flex;gap:1.5mm;}" +
    ".lb-ghs img{display:block;}" +
    ".lb-signal{font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;font-weight:700;font-size:4mm;line-height:1;}" +
    // 유해·위험문구 / 예방조치문구 (첫 번째 라벨 견본처럼 왼쪽에 세로 제목)
    ".lb-hz{flex:none;height:19mm;display:flex;border-top:0.25mm solid #000;font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;}" +
    ".lb-hz-col{display:flex;min-width:0;}" +
    ".lb-hz-col.h{flex:0 0 45%;}" +
    ".lb-hz-col.p{flex:1;border-left:0.25mm solid #000;}" +
    ".lb-hz-tag{flex:none;width:5.2mm;border-right:0.25mm solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:2.9mm;line-height:1.08;font-weight:700;}" +
    ".lb-hz-text{flex:1;min-width:0;overflow:hidden;padding:1.2mm 1.6mm;text-align:left;font-size:3.4mm;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;}" +
    ".lb-hz-text p{margin:0;}" +
    ".lb-foot{flex:none;border-top:0.25mm solid #000;padding:0.5mm 2mm;text-align:center;font-family:'Malgun Gothic','맑은 고딕','Pretendard',sans-serif;font-size:2mm;line-height:1.35;}" +
    ".lb-foot b{font-weight:400;}";

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

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) {
        return;
      }
      if (key === "class") {
        node.className = value;
      } else if (key === "text") {
        node.textContent = value;
      } else if (key.indexOf("on") === 0) {
        node.addEventListener(key.slice(2), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, value);
      }
    });
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  // 그림문자 SVG를 data URL로 한 번 읽어 둔다 (인쇄 창·ZPL 그림에서도 같은 그림을 쓰려고)
  var ghsCache = {};
  function loadGhs(base) {
    if (!ghsCache[base]) {
      ghsCache[base] = Promise.all(GHS_CODES.map(function (c) {
        return fetch(base + c + ".svg").then(function (res) {
          if (!res.ok) {
            throw new Error(c);
          }
          return res.blob();
        }).then(function (blob) {
          return new Promise(function (resolve) {
            var fr = new FileReader();
            fr.onload = function () { resolve(fr.result); };
            fr.readAsDataURL(blob);
          });
        }).catch(function () { return base + c + ".svg"; });
      })).then(function (list) {
        var out = {};
        GHS_CODES.forEach(function (c, i) { out[c] = list[i]; });
        return out;
      });
    }
    return ghsCache[base];
  }

  function setMsg(node, text, kind) {
    node.textContent = text;
    node.className = "a-msg" + (kind ? " is-" + kind : "");
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

  function hazardRank(line) {
    var m = String(line).match(/^H(\d{3})/);
    var c = m ? Number(m[1]) : 0;
    if (c >= 310 && c <= 329) { return 0; }
    if (c >= 340 && c <= 373) { return 1; }
    if (c >= 300 && c <= 339) { return 2; }
    return 3;
  }

  // 유해·위험문구를 피부·눈 자극 → 암·생식독성 등 → 삼키면 유해 같은 급성독성 → 그 밖 순서로 (같은 묶음은 MSDS 순서)
  function sortHazards(list) {
    return list.map(function (l, i) { return { l: l, i: i, r: hazardRank(l) }; })
      .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
      .map(function (x) { return x.l; });
  }

  function supplierLine(name, addr, tel) {
    return [name && "공급원: " + name, addr, tel && "Tel " + tel].filter(Boolean).join(" · ");
  }


  // 그림문자에 맞춰 예방조치문구를 P_LINES 줄 고른다. 그림문자마다 몫(1개 3줄, 2개 2·1줄, 3개 1줄씩 …)을 나누고,
  // 그 그림문자의 우선 문구 중 MSDS에 있는 것을 고른다. 모자라면 MSDS 순서대로 남은 문구로 채운다.
  function selectPrecautions(all, pictos) {
    var codeOf = function (line) {
      var m = String(line).match(STMT_CODE_RE);
      return m ? m[1].replace(/\s+/g, "") : "";
    };
    var used = [];
    var take = function (line) {
      if (line && used.indexOf(line) < 0 && used.length < P_LINES) {
        used.push(line);
        return true;
      }
      return false;
    };
    var list = pictos.slice(0, P_LINES);
    list.forEach(function (g, i) {
      var quota = Math.floor(P_LINES / list.length) + (i < P_LINES % list.length ? 1 : 0);
      (P_BY_GHS[g] || []).forEach(function (code) {
        if (quota <= 0) {
          return;
        }
        var hit = all.filter(function (l) { return codeOf(l) === code && used.indexOf(l) < 0; })[0];
        if (take(hit)) {
          quota--;
        }
      });
    });
    all.forEach(take);
    // 그림문자 순서대로 묶어서 보여 준다
    return used;
  }

  // ---------- 라벨 그리기 ----------
  // 그림문자 한 줄 크기(mm): 많으면 줄인다
  function ghsSize(n) {
    return n <= 4 ? 12 : n <= 5 ? 11 : 10;
  }

  // QR 코드 → PNG 그림 (data URL). 글자가 없거나 도구가 없으면 ""
  function qrDataUrl(text) {
    if (!text || !window.qrcode) {
      return "";
    }
    try {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs["UTF-8"] || window.qrcode.stringToBytes;
      var qr = window.qrcode(0, "M");
      qr.addData(text);
      qr.make();
      // 칸 하나를 정수 픽셀로 그린 PNG (그림 변환·인쇄에서 흐려지지 않게)
      var n = qr.getModuleCount();
      var cell = Math.max(4, Math.ceil(600 / n));
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = n * cell;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(c * cell, r * cell, cell, cell);
          }
        }
      }
      return canvas.toDataURL("image/png");
    } catch (e) {
      return "";
    }
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
    var qrSrc = qrDataUrl(d.qr);
    var qr = qrSrc ? '<div class="lb-qr"><img src="' + qrSrc + '" alt="QR"></div>' : "";
    var warn = "";
    if (d.pictos.length || d.signal || qr) {
      var size = ghsSize(d.pictos.length);
      var imgs = d.pictos.map(function (c) {
        return '<img src="' + esc(ghsSrc[c] || "ghs/" + c + ".svg") + '" alt="' + c + '" style="width:' + size + "mm;height:" + size + 'mm">';
      }).join("");
      warn = '<div class="lb-warn"><div class="lb-warn-l"><div class="lb-ghs">' + imgs + "</div>" +
        (d.signal ? '<div class="lb-signal">' + esc(d.signal) + "</div>" : "") + "</div>" + qr + "</div>";
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
        '<div class="lb-hz-col h">' + tag("유해위험문구") + '<div class="lb-hz-text">' + d.h.map(function (l) { return "<p>· " + esc(stmt(l)) + "</p>"; }).join("") + "</div></div>" +
        '<div class="lb-hz-col p">' + tag("예방조치문구") + '<div class="lb-hz-text">' + d.p.map(function (l) { return "<p>· " + esc(stmt(l)) + "</p>"; }).join("") + "</div></div>" +
        "</div>";
    }
    var foot = d.notice || d.supplier
      ? '<div class="lb-foot">' + (d.notice ? "<b>" + esc(d.notice) + "</b>" : "") + (d.notice && d.supplier ? "<br>" : "") + esc(d.supplier) + "</div>"
      : "";
    return '<div class="lb-label' + (hz ? " has-hz" : "") + (warn ? " has-warn" : "") + '"><div class="lb-frame"><div class="lb-inner">' +
      '<div class="lb-head"><div class="lb-code">' + esc(d.code) + "</div>" +
      (d.resin ? '<div class="lb-resin">(' + esc(d.resin) + ")</div>" : "") + "</div>" +
      '<div class="lb-name">' + esc(d.name) + "</div>" +
      '<div class="lb-body"><div class="lb-fields">' + rows + "</div>" +
      (d.no ? '<div class="lb-no"' + (d.noHidden ? ' style="visibility:hidden"' : "") + ">No. " + esc(d.no) + "</div>" : "") + "</div>" +
      warn + hz + foot +
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
    // 유해위험문구와 예방조치문구 글씨 크기를 작은 쪽에 맞춘다
    var texts = root.querySelectorAll(".lb-hz-text");
    if (texts.length > 1) {
      var min = Math.min.apply(null, Array.prototype.map.call(texts, function (node) {
        return parseFloat(node.ownerDocument.defaultView.getComputedStyle(node).fontSize);
      }));
      Array.prototype.forEach.call(texts, function (node) { node.style.fontSize = min + "px"; });
    }
    return overflow;
  }

  function imagesReady(root) {
    return Promise.all(Array.prototype.map.call(root.querySelectorAll("img"), function (img) {
      return img.complete ? null : new Promise(function (r) { img.onload = img.onerror = r; });
    }));
  }

  // ---------- 브라우저 인쇄 (라벨 크기 쪽으로) ----------
  function printLabels(d, ghsSrc, copies, start) {
    return new Promise(function (resolve) {
      var frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      var pages = [];
      for (var i = 0; i < copies; i++) {
        pages.push(buildLabelHtml(Object.assign({}, d, { no: start + i }), ghsSrc));
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

  // 흑백 비트맵 행들(16진 글자). 검정 = 1
  function bitmapRows(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var px = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    var bpr = Math.ceil(w / 8);
    var HEX = "0123456789ABCDEF";
    var parts = [];
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
      parts.push(hex);
    }
    return { bpr: bpr, rows: parts };
  }

  // 작은 그림 → ^GFA (압축)
  function gfa(canvas) {
    var b = bitmapRows(canvas);
    var prev = null;
    var data = b.rows.map(function (hex) {
      var out = zplRow(hex, prev);
      prev = hex;
      return out;
    }).join("");
    var total = b.bpr * b.rows.length;
    return "^GFA," + total + "," + total + "," + b.bpr + "," + data;
  }

  // 번호 글자 그림 (화면 라벨과 같은 글꼴). 돌려 찍을 때는 그림도 90° 돌린다.
  function numberCanvas(text, box, rotate) {
    var c = document.createElement("canvas");
    c.width = box.w;
    c.height = box.h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#000";
    ctx.font = box.font;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(text, box.w - 1, box.h / 2);
    if (!rotate) {
      return c;
    }
    var r = document.createElement("canvas");
    r.width = box.h;
    r.height = box.w;
    var rc = r.getContext("2d");
    rc.translate(box.h, 0);
    rc.rotate(Math.PI / 2);
    rc.drawImage(c, 0, 0);
    return r;
  }

  var ZPL_GRF = "R:DYLABEL.GRF";

  function labelsToZpl(base, box, rotate, copies, start) {
    var w = base.canvas.width;
    var h = base.canvas.height;
    var b = bitmapRows(base.canvas);
    var out = ["~DG" + ZPL_GRF + "," + (b.bpr * b.rows.length) + "," + b.bpr + "," + b.rows.join("")];
    // 돌려 찍을 때 번호 칸 위치: (x, y) → (H - y - 높이, x)
    var fx = rotate ? base.H - box.y - box.h : box.x;
    var fy = rotate ? box.x : box.y;
    for (var i = 0; i < copies; i++) {
      out.push("^XA^CI28^PW" + w + "^LL" + h + "^LH0,0^FO0,0^XG" + ZPL_GRF + ",1,1^FS" +
        "^FO" + fx + "," + fy + gfa(numberCanvas("No. " + (start + i), box, rotate)) + "^FS^PQ1^XZ");
    }
    out.push("^XA^ID" + ZPL_GRF + "^FS^XZ");
    return out.join("\n") + "\n";
  }

  async function labelCanvas(d, ghsSrc, dpi, rotate) {
    if (!window.html2canvas) {
      throw new Error("그림 변환 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    }
    var holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;";
    holder.innerHTML = "<style>" + LABEL_CSS + "</style>" + buildLabelHtml(Object.assign({}, d, { no: d.no || 1, noHidden: true }), ghsSrc);
    document.body.appendChild(holder);
    try {
      var node = holder.querySelector(".lb-label");
      await imagesReady(node);
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      fitText(node);
      var k = dpi / 96;
      var lr = node.getBoundingClientRect();
      var noEl = node.querySelector(".lb-no");
      var box = null;
      if (noEl) {
        var nr = noEl.getBoundingClientRect();
        var cs = getComputedStyle(noEl);
        box = {
          x: Math.round((nr.left - lr.left) * k),
          y: Math.round((nr.top - lr.top) * k),
          w: Math.ceil(nr.width * k) + 2,
          h: Math.ceil(nr.height * k) + 2,
          font: cs.fontWeight + " " + Math.round(parseFloat(cs.fontSize) * k) + "px " + cs.fontFamily
        };
      }
      var shot = await window.html2canvas(node, { scale: k, backgroundColor: "#ffffff", logging: false, useCORS: true });
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
      return { canvas: out, box: box, H: H };
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
  window.DY_LABEL_PRINT = function (main, src) {
    var saved = Object.assign({}, DEFAULTS, readJson(SETTINGS_KEY, {}));
    var assetBase = src.assetBase || "ghs/";
    var rows = [];
    var ghsSrc = {};
    var pendingCode = "";
    var current = null; // 고른 제품
    var allP = []; // MSDS의 예방조치문구 전체
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
      start: el("input", { type: "number", min: "1", max: "99999", value: "1" }),
      dpi: el("select", {}, [
        el("option", { value: "203", text: "203 dpi (8 dots/mm)" }),
        el("option", { value: "300", text: "300 dpi (12 dots/mm)" })
      ]),
      rotate: el("input", { type: "checkbox" }),
      h: el("textarea", { rows: "4", maxlength: "3000" }),
      p: el("textarea", { rows: "10", maxlength: "6000" }),
      showCodes: el("input", { type: "checkbox" }),
      notice: el("input", { type: "text", maxlength: "200", value: saved.notice }),
      qr: el("input", { type: "text", maxlength: "500", value: saved.qr, placeholder: "예: https://daeyangpnt.co.kr/msds" }),
      supplier: el("input", { type: "text", maxlength: "300", value: supplierLine(SUPPLIER_NAME, SUPPLIER_ADDR, SUPPLIER_TEL) })
    };
    f.lot.value = suggestLot(f.date.value);
    f.dpi.value = saved.dpi;
    f.rotate.checked = !!saved.rotate;
    f.showCodes.checked = !!saved.showCodes;
    var fitWarn = el("p", { class: "a-msg is-error", hidden: true, text: "문구가 길어 라벨 칸을 넘칩니다. 가장 작은 글씨로도 잘리니 [예방조치문구]에서 덜 중요한 줄을 지워 주세요." });

    var ghsBoxes = {};
    var ghsPick = el("div", { class: "lb-ghs-pick" }, GHS_CODES.map(function (c) {
      var box = el("input", { type: "checkbox", value: c, onchange: function () { autoP(false); draw(); } });
      ghsBoxes[c] = box;
      return el("label", { class: "lb-ghs-opt", title: c + " " + GHS_NAME[c] }, [box, el("img", { src: assetBase + c + ".svg", alt: "" }), el("span", { text: GHS_NAME[c] })]);
    }));

    var preview = el("div", { class: "lb-preview" });
    var printBtn = el("button", { class: "a-btn", type: "button", text: "인쇄", onclick: onPrint });
    var zplBtn = el("button", { class: "a-btn a-btn--ghost", type: "button", text: "ZPL 파일 저장", onclick: onZpl });

    function field(label, input, hint) {
      return el("label", { class: "a-field" }, [label, hint ? el("small", { text: hint }) : null, input]);
    }

    main.replaceChildren(
      el("h1", { text: "라벨 출력" }),
      el("p", { class: "panel-lede", text: src.lede || "" }),
      el("div", { class: "lb-grid" }, [
        el("div", { class: "lb-col" }, [
          el("section", { class: "a-card" }, [
            el("h2", { text: src.searchTitle || "1. 제품 찾기" }),
            field("품명 · 제품코드", search),
            results,
            hazMsg
          ].concat(src.extra ? src.extra({ el: el, setMsg: setMsg }) : [])),
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
              field("신호어", f.signal, "MSDS에 적힌 신호어(위험/경고) · 필요하면 바꿀 수 있음")
            ]),
            el("div", { class: "a-field" }, ["그림문자", el("small", { text: "MSDS에서 불러온 그림문자가 체크됩니다. 필요하면 직접 바꿀 수 있습니다." }), ghsPick])
          ]),
          el("section", { class: "a-card" }, [
            el("h2", { text: "3. 유해·위험문구 · 예방조치문구" }),
            el("p", { class: "a-hint", text: "MSDS 2번 항목의 문구를 한 줄에 하나씩 불러옵니다. 예방조치문구는 그림문자에 해당하는 문구로 3줄만 넣습니다. 칸을 넘치면 글씨가 자동으로 작아집니다." }),
            field("유해·위험문구", f.h, "한 줄에 하나 · 라벨에는 '·' 목록으로 표시"),
            field("예방조치문구", f.p, "그림문자에 맞춰 MSDS에서 3줄을 고릅니다 (그림문자 1개: 3줄, 2개: 2줄 + 1줄) · 라벨에는 '·' 목록으로 표시"),
            el("div", { class: "a-row" }, [
              el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "그림문자에 맞춰 3줄 다시 고르기", onclick: function () { autoP(true); draw(); } }),
              el("button", { class: "a-btn a-btn--ghost a-btn--sm", type: "button", text: "MSDS 예방조치문구 전체 넣기", onclick: function () { f.p.value = allP.join("\n"); f.p.dataset.touched = "1"; draw(); } })
            ]),
            el("label", { class: "a-check" }, [f.showCodes, "문구 앞 코드(H351, P280 등)도 라벨에 표시"]),
            field("하단 안내 문구", f.notice),
            field("공급원", f.supplier, "주소는 포천 제2공장, 회사명·전화번호는 MSDS 값"),
            field("QR 코드 내용", f.qr, "그림문자 줄 맨 오른쪽에 넣을 QR 코드의 주소나 글자 · 비우면 QR 코드 없음")
          ])
        ]),
        el("div", { class: "lb-col" }, [
          el("section", { class: "a-card lb-sticky" }, [
            el("h2", { text: "4. 미리보기 · 출력" }),
            el("div", { class: "lb-preview-wrap" }, [preview]),
            fitWarn,
            el("div", { class: "lb-form-grid" }, [
              field("매수", f.copies, "장마다 번호가 1번부터 차례로 찍힘"),
              field("시작 번호", f.start, "QR 코드 위 번호 · 이어서 뽑을 때 바꿈"),
              field("프린터 해상도 (ZPL)", f.dpi, "ZT421 뒷면 라벨에서 확인"),
              el("label", { class: "a-check lb-span" }, [f.rotate, "ZPL을 90° 돌려서 출력 (라벨이 세로로 들어갈 때)"])
            ]),
            el("div", { class: "a-row" }, [printBtn, zplBtn]),
            el("p", { class: "a-hint", text: "[인쇄] Windows 프린터 목록에서 ZDesigner ZT421을 고르고, 드라이버의 용지(라벨) 크기를 130 × 100mm, 여백 없음, 배율 100%로 맞춰 주세요. " +
              "[ZPL 파일 저장] 라벨을 그림으로 바꾼 ZPL을 저장합니다. Zebra Setup Utilities의 [파일 보내기]나 프린터 웹 화면(Directories → 파일 보내기)으로 보내면 드라이버 설정과 관계없이 정확한 크기로 찍힙니다." }),
            msg
          ])
        ])
      ])
    );

    function lines(text) {
      return String(text).split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    }

    function startNo() {
      var n = Math.round(Number(f.start.value));
      return n >= 1 ? n : 1;
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
        qr: f.qr.value.trim(),
        no: startNo(),
        pictos: GHS_CODES.filter(function (c) { return ghsBoxes[c].checked; })
      };
    }

    // 직접 고친 예방조치문구는 그림문자를 바꿔도 덮어쓰지 않는다 (force면 다시 고른다)
    function autoP(force) {
      if (!force && f.p.dataset.touched) {
        return;
      }
      delete f.p.dataset.touched;
      f.p.value = selectPrecautions(allP, GHS_CODES.filter(function (c) { return ghsBoxes[c].checked; })).join("\n");
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
    f.p.addEventListener("input", function () { f.p.dataset.touched = "1"; });

    function remember() {
      writeJson(SETTINGS_KEY, {
        dry: f.dry.value.trim(),
        keep: f.keep.value.trim(),
        weight: f.weight.value.trim(),
        dpi: f.dpi.value,
        rotate: f.rotate.checked,
        showCodes: f.showCodes.checked,
        notice: f.notice.value.trim(),
        qr: f.qr.value.trim()
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
      return { d: d, n: n, start: startNo() };
    }

    async function onPrint() {
      var c = check();
      if (!c) {
        return;
      }
      setMsg(msg, "인쇄 창을 여는 중...");
      await printLabels(c.d, ghsSrc, c.n, c.start);
      remember();
      setMsg(msg, "인쇄 창을 열었습니다 (No. " + c.start + " ~ No. " + (c.start + c.n - 1) + "). 다음 제조번호를 쓰려면 [제조번호]를 확인해 주세요.", "ok");
    }

    async function onZpl() {
      var c = check();
      if (!c) {
        return;
      }
      zplBtn.disabled = true;
      setMsg(msg, "ZPL 파일을 만드는 중...");
      try {
        var base = await labelCanvas(c.d, ghsSrc, Number(f.dpi.value), f.rotate.checked);
        var name = (c.d.code + " " + c.d.lot).replace(/[\\/:*?"<>|#]+/g, "_").trim() + ".zpl";
        saveFile(labelsToZpl(base, base.box, f.rotate.checked, c.n, c.start), name);
        remember();
        setMsg(msg, "ZPL 파일을 저장했습니다: " + name + " (" + base.canvas.width + "×" + base.canvas.height + " dots, " + c.n + "매, No. " + c.start + " ~ No. " + (c.start + c.n - 1) + ")", "ok");
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
        return norm(r.product_name).indexOf(q) >= 0 || norm(r.product_code).indexOf(q) >= 0;
      }).slice(0, 12);
      if (!hits.length) {
        results.appendChild(el("li", { class: "a-empty", text: src.emptyText || "일치하는 제품이 없습니다. 아래 칸에 직접 입력해 주세요." }));
        return;
      }
      hits.forEach(function (r) {
        results.appendChild(el("li", {}, [el("button", {
          type: "button",
          class: "lb-hit" + (current && current.key === r.key ? " is-on" : ""),
          onclick: function () { pick(r); }
        }, [el("b", { text: r.product_code || "-" }), el("span", { text: r.product_name || "" })])]));
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
      f.name.value = r.product_name || "";
      GHS_CODES.forEach(function (c) { ghsBoxes[c].checked = false; });
      f.signal.value = "";
      f.h.value = "";
      f.p.value = "";
      allP = [];
      delete f.p.dataset.touched;
      drawResults();
      draw();
      setMsg(hazMsg, "그림문자·문구를 불러오는 중...");
      try {
        var info = await src.load(r);
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
        allP = info.p;
        autoP(true);
        f.supplier.value = supplierLine(info.supplierName || SUPPLIER_NAME, SUPPLIER_ADDR, info.tel || SUPPLIER_TEL);
        draw();
        var savedNote = "";
        if (src.afterLoad) {
          try {
            savedNote = await src.afterLoad(r, info);
          } catch (err) {
            savedNote = "라벨용 정보 저장 실패: " + (err && err.message || err);
          }
          if (seq !== loadSeq) {
            return;
          }
        }
        setMsg(hazMsg, (info.source + "에서 불러옴 · ") +
          (info.pictos.length ? "그림문자 " + info.pictos.map(function (c) { return GHS_NAME[c]; }).join(", ") : "그림문자 없음") +
          (info.signal ? " · 신호어 " + info.signal : "") +
          (info.codes.length ? " · " + info.codes.join(" ") : "") +
          " · 유해·위험문구 " + info.h.length + "줄, 예방조치문구 " + info.p.length + "줄" +
          (savedNote ? " · " + savedNote : ""), /실패/.test(savedNote) ? "error" : info.pictos.length || info.codes.length ? "ok" : null);
      } catch (err) {
        if (seq !== loadSeq) {
          return;
        }
        setMsg(hazMsg, "그림문자·문구를 불러오지 못했습니다 (" + (err && err.message || err) + "). 그림문자를 직접 체크해 주세요.", "error");
      }
    }

    // 제품코드로 바로 고르기 (재고관리 앱의 품목 상세에서 [라벨 출력]을 눌렀을 때)
    function pickCode(code) {
      var n = norm(code);
      var hit = rows.filter(function (r) { return norm(r.product_code) === n; })[0];
      if (hit) {
        search.value = hit.product_code;
        pick(hit);
        return true;
      }
      if (!rows.length) {
        pendingCode = code;
      }
      search.value = code;
      drawResults();
      return false;
    }

    draw();
    setMsg(hazMsg, "제품 목록을 불러오는 중...");
    Promise.all([src.list(), loadGhs(assetBase)]).then(function (res) {
      rows = res[0];
      ghsSrc = res[1];
      setMsg(hazMsg, "제품 " + rows.length + "개에서 찾습니다.");
      draw();
      if (pendingCode) {
        var code = pendingCode;
        pendingCode = "";
        pickCode(code);
      }
    }).catch(function (err) {
      setMsg(hazMsg, "제품 목록을 불러오지 못했습니다 (" + (err && err.message || err) + "). 제품 정보를 직접 입력해 주세요.", "error");
    });

    return { pickCode: pickCode };
  };
  window.DY_LABEL_PRINT.sortHazards = sortHazards;
})();
