/* ==========================================================
   CaseRecord · 报告详情页
   根据 caseId + idx 定位并全屏展示某份检验/检查报告
   ========================================================== */
(function () {
  "use strict";

  var CASES_KEY = "caseRecord.cases";

  function readCases() {
    try {
      var arr = JSON.parse(localStorage.getItem(CASES_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- 定位报告 ---------- */

  var caseId = null;
  var idx = -1;
  try {
    var qs = new URLSearchParams(window.location.search);
    caseId = qs.get("caseId");
    idx = parseInt(qs.get("idx"), 10);
  } catch (e) {
    /* ignore */
  }

  var list = readCases();
  var c = null;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(caseId)) {
      c = list[i];
      break;
    }
  }

  var img = c && c.images && !isNaN(idx) ? c.images[idx] : null;
  if (!c || !img) {
    window.location.replace("dashboard.html");
    return;
  }

  /* ---------- 渲染 ---------- */

  $("back-link").href = "case-detail.html?id=" + c.id;

  var d = new Date(c.createdAt);
  $("report-meta").textContent =
    (img.name || "报告 " + (idx + 1)) + " · 记录于 " + d.toLocaleString("zh-CN");

  var content = $("report-content");

  if (img.type && img.type.indexOf("image/") === 0) {
    var im = document.createElement("img");
    im.className = "report-img";
    im.src = img.dataUrl;
    im.alt = img.name || "报告";
    content.appendChild(im);
  } else {
    // PDF：内嵌预览 + 打开链接
    var iframe = document.createElement("iframe");
    iframe.className = "report-pdf-frame";
    iframe.src = img.dataUrl;
    iframe.title = img.name || "PDF 报告";
    content.appendChild(iframe);

    var link = document.createElement("a");
    link.className = "report-open";
    link.href = img.dataUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "在新标签页打开 / 下载";
    content.appendChild(link);
  }

  /* ==========================================================
     OCR 自动识别（打开页面即开始）
     图片报告才可识别；file:// 直开受限，需本地服务器
     ========================================================== */

  var ocrSection = document.getElementById("ocr-section");
  var ocrStatus = document.getElementById("ocr-status");
  var ocrTableWrap = document.getElementById("ocr-table-wrap");
  var ocrTbody = document.getElementById("ocr-tbody");
  var ocrRawWrap = document.getElementById("ocr-raw-wrap");
  var ocrRaw = document.getElementById("ocr-raw");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showOcrStatus(msg, isError) {
    ocrStatus.textContent = msg;
    ocrStatus.className = "ocr-status" + (isError ? " err" : "");
    ocrStatus.hidden = false;
  }

  function isFileProtocol() {
    return window.location.protocol === "file:";
  }

  // 打开页面自动识别
  function startAutoOcr() {
    ocrSection.hidden = false;
    ocrTableWrap.hidden = true;
    ocrRawWrap.hidden = true;
    ocrStatus.hidden = true;

    // PDF 报告不支持 OCR
    if (img.type && img.type.indexOf("image/") !== 0) {
      showOcrStatus("PDF 报告暂不支持自动识别，可直接查看或下载。", true);
      return;
    }

    if (isFileProtocol()) {
      showOcrStatus(
        "当前是直接双击打开（file://），浏览器禁止加载识别引擎。\n请通过 start.bat 或本地服务器打开 http://localhost:8080/",
        true
      );
      return;
    }

    // 引擎可能仍在后台加载（首次需从网络下载模型），自动等待后识别
    var waited = 0;
    function tryRun() {
      if (typeof window.runPaddleOCR === "function") {
        runOcr();
        return;
      }
      if (window.paddleOcrStatus) {
        var st = String(window.paddleOcrStatus());
        if (st.indexOf("error") === 0) {
          showOcrStatus("识别引擎加载失败：" + st.slice(6) + "（请检查网络后刷新页面重试）", true);
          return;
        }
      }
      waited += 2000;
      if (waited > 120000) {
        showOcrStatus("识别引擎加载超时，请检查网络后刷新页面重试。", true);
        return;
      }
      showOcrStatus("识别引擎加载中（首次需从网络下载模型，约 10-60 秒），请稍候…");
      setTimeout(tryRun, 2000);
    }
    tryRun();
  }

  var ocrBusy = false;

  function runOcr() {
    if (ocrBusy) return;
    ocrBusy = true;
    showOcrStatus("正在识别，首次使用需加载识别模型（约 10-30 秒），请稍候…");

    window
      .runPaddleOCR(img.dataUrl)
      .then(function (text) {
        ocrBusy = false;
        text = String(text || "").trim();
        if (!text) {
          showOcrStatus("未能识别出文字，请确认报告图片清晰、未倾斜。", true);
          return;
        }
        ocrRaw.textContent = text;
        ocrRawWrap.hidden = false;
        var parsed = parseLabReport(text);
        renderLabTable(parsed);
        var count = 0;
        for (var k in parsed) {
          if (parsed.hasOwnProperty(k)) count++;
        }
        if (count) {
          showOcrStatus("识别完成，已填入 " + count + " 项血常规指标，可对照原文核对。");
        } else {
          showOcrStatus("识别完成，但未识别到血常规指标，请对照下方原文查看。");
        }
      })
      .catch(function (err) {
        ocrBusy = false;
        showOcrStatus("识别失败：" + (err && err.message ? err.message : err), true);
      });
  }

  /* ---------- 血常规标准项目清单（固定显示，含默认单位、标准参考范围与别名） ---------- */

  var CBC_ITEMS = [
    { name: "白细胞计数", unit: "×10⁹/L", range: "3.5-9.5", aliases: ["白细胞计数", "白细胞数目", "白细胞计", "白细胞", "WBC"] },
    { name: "淋巴细胞百分数", unit: "%", range: "20-50", aliases: ["淋巴细胞百分数", "淋巴细胞百分比", "淋巴细胞比率", "淋巴细胞", "淋巴百分数", "LYMPH%", "LYMPH"] },
    { name: "单核细胞百分数", unit: "%", range: "3-10", aliases: ["单核细胞百分数", "单核细胞百分比", "单核细胞比率", "单核细胞", "MONO%", "MONO"] },
    { name: "嗜中性粒细胞百分数", unit: "%", range: "40-75", aliases: ["嗜中性粒细胞百分数", "嗜中性粒细胞百分比", "嗜中性粒细胞比率", "嗜中性粒细胞", "中性粒细胞百分数", "中性粒细胞百分比", "中性粒细胞", "NEUT%", "NEUT"] },
    { name: "嗜酸性粒细胞百分数", unit: "%", range: "0.4-8", aliases: ["嗜酸性粒细胞百分数", "嗜酸性粒细胞百分比", "嗜酸性粒细胞比率", "嗜酸性粒细胞", "EO%", "EOS"] },
    { name: "嗜碱性粒细胞百分数", unit: "%", range: "0-1", aliases: ["嗜碱性粒细胞百分数", "嗜碱性粒细胞百分比", "嗜碱性粒细胞比率", "嗜碱性粒细胞", "BASO%", "BASO"] },
    { name: "淋巴细胞绝对值", unit: "×10⁹/L", range: "1.1-3.2", aliases: ["淋巴细胞绝对值", "淋巴绝对值", "LYMPH#"] },
    { name: "单核细胞绝对值", unit: "×10⁹/L", range: "0.1-0.6", aliases: ["单核细胞绝对值", "MONO#"] },
    { name: "嗜中性粒细胞绝对值", unit: "×10⁹/L", range: "1.8-6.3", aliases: ["嗜中性粒细胞绝对值", "中性粒细胞绝对值", "NEUT#"] },
    { name: "嗜酸性粒细胞绝对值", unit: "×10⁹/L", range: "0.02-0.52", aliases: ["嗜酸性粒细胞绝对值", "EO#"] },
    { name: "红细胞计数", unit: "×10¹²/L", range: { male: "4.3-5.8", female: "3.8-5.1" }, aliases: ["红细胞计数", "红细胞数目", "红细胞计", "RBC"] },
    { name: "血红蛋白浓度", unit: "g/L", range: { male: "130-175", female: "115-150" }, aliases: ["血红蛋白浓度", "血红蛋白", "HGB", "Hb"] },
    { name: "红细胞比积", unit: "%", range: { male: "40-50", female: "35-45" }, aliases: ["红细胞比积", "红细胞压积", "红细胞比容", "HCT"] },
    { name: "平均红细胞体积", unit: "fL", range: "82-100", aliases: ["平均红细胞体积", "平均红细胞体", "红细胞平均体积", "MCV"] },
    { name: "平均红细胞血红蛋白含量", unit: "pg", range: "27-34", aliases: ["平均红细胞血红蛋白含量", "平均红细胞血红白含量", "平均红细胞血红蛋白量", "MCH"] },
    { name: "平均红细胞血红蛋白浓度", unit: "g/L", range: "316-354", aliases: ["平均红细胞血红蛋白浓度", "平均红细胞血红白浓度", "MCHC"] },
    { name: "红细胞分布宽度", unit: "%", range: "11-16", aliases: ["红细胞分布宽度", "红细胞分布宽度变异系数", "RDW"] },
    { name: "血小板计数", unit: "×10⁹/L", range: "125-350", aliases: ["血小板计数", "血小板数目", "血小板计", "血小板", "PLT"] },
    { name: "血小板比积", unit: "%", range: "0.11-0.28", aliases: ["血小板比积", "PCT"] },
    { name: "血小板平均体积", unit: "fL", range: "7-11", aliases: ["血小板平均体积", "血小板平均体", "MPV"] },
    { name: "血小板分布宽度", unit: "%", range: "9-17", aliases: ["血小板分布宽度", "PDW"] },
    { name: "嗜碱性粒细胞绝对值", unit: "×10⁹/L", range: "0-0.1", aliases: ["嗜碱性粒细胞绝对值", "BASO#"] }
  ];

  // 档案性别（用于分性别的参考范围判断）
  var profileGender = "";
  try {
    var profile = JSON.parse(localStorage.getItem("caseRecord.profile"));
    if (profile && profile.gender) profileGender = profile.gender;
  } catch (e) {
    /* ignore */
  }

  function pickRange(item) {
    var r = item.range;
    if (typeof r === "string") return r;
    return profileGender === "女" && r.female ? r.female : r.male || "";
  }

  function rangeText(item) {
    var r = item.range;
    if (typeof r === "string") return r;
    return "男" + r.male + " / 女" + r.female;
  }

  function normalize(s) {
    // 去空格、标点、全半角差异、统一小写，便于模糊比对
    return String(s)
      .toLowerCase()
      .replace(/[\s\-－_（）()·、，,.:：/\\|｜%#^*^×μµ]/g, "");
  }

  function subsequenceScore(name, line) {
    // 名字字符按顺序出现在行中的比例（容忍 OCR 漏字/错位）
    var n = normalize(name);
    var l = normalize(line);
    if (!n || !l) return 0;
    var i = 0;
    var hit = 0;
    for (var j = 0; j < n.length; j++) {
      var idx = l.indexOf(n[j], i);
      if (idx !== -1) {
        hit++;
        i = idx + 1;
      }
    }
    return hit / n.length;
  }

  function matchCbcItem(line) {
    // 精确子串命中：最长别名优先，避免“淋巴细胞”误匹配“淋巴细胞绝对值”
    // 无精确命中时：用子序列相似度模糊匹配，相近即可（阈值 0.55）
    var best = null;
    var bestScore = 0;
    var bestLen = 0;
    for (var i = 0; i < CBC_ITEMS.length; i++) {
      var item = CBC_ITEMS[i];
      var cands = [item.name].concat(item.aliases);
      for (var j = 0; j < cands.length; j++) {
        var alias = cands[j];
        if (!alias) continue;
        if (line.indexOf(alias) > -1) {
          if (alias.length > bestLen) {
            bestLen = alias.length;
            bestScore = 1;
            best = item;
          }
        } else {
          var s = subsequenceScore(alias, line);
          if (s > bestScore) {
            bestScore = s;
            best = item;
          }
        }
      }
    }
    return bestScore >= 0.4 ? best : null;
  }

  /* ---------- 检验报告解析：只匹配血常规清单，返回 name -> 数据 映射 ---------- */

  function parseLabReport(text) {
    var lines = text.split(/\r?\n/);
    var map = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var r = parseLabLine(line);
      if (r && !map[r.name]) map[r.name] = r;
    }
    return map;
  }

  function parseLabLine(line) {
    var cbc = matchCbcItem(line);
    if (!cbc) return null; // 仅解析血常规清单内项目

    var numMatch = line.match(/(-?\d+(?:\.\d+)?)/);
    if (!numMatch) return null;
    var value = parseFloat(numMatch[1]);
    if (isNaN(value)) return null;

    // 状态判断：优先 ↑/↓ 标记，否则按标准参考范围比较
    var status = "";
    if (/↑|H\b|偏高/.test(line)) status = "偏高";
    else if (/↓|L\b|偏低/.test(line)) status = "偏低";
    else {
      var r = parseRange(pickRange(cbc));
      if (r) {
        if (r.op === "range") {
          if (value > r.hi) status = "偏高";
          else if (value < r.lo) status = "偏低";
          else status = "正常";
        } else if (r.op === "lt" && value >= r.num) {
          status = "偏高";
        } else if (r.op === "gt" && value <= r.num) {
          status = "偏低";
        }
      }
    }

    return {
      name: cbc.name,
      value: numMatch[1],
      unit: cbc.unit,
      range: pickRange(cbc),
      status: status
    };
  }

  function parseRange(rangeStr) {
    if (!rangeStr) return null;
    var m = rangeStr.match(/^(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)$/);
    if (m) return { op: "range", lo: parseFloat(m[1]), hi: parseFloat(m[2]) };
    var m2 = rangeStr.match(/^<(\d+(?:\.\d+)?)$/);
    if (m2) return { op: "lt", num: parseFloat(m2[1]) };
    var m3 = rangeStr.match(/^>(\d+(?:\.\d+)?)$/);
    if (m3) return { op: "gt", num: parseFloat(m3[1]) };
    return null;
  }

  function renderLabTable(parsed) {
    var html = "";
    for (var i = 0; i < CBC_ITEMS.length; i++) {
      var item = CBC_ITEMS[i];
      var r = parsed[item.name] || {};
      var status = r.status || "—";
      var cls = status === "偏高" ? "up" : status === "偏低" ? "down" : status === "正常" ? "ok" : "";
      html +=
        "<tr>" +
        "<td>" + item.name + "</td>" +
        "<td>" + (r.value || "—") + "</td>" +
        "<td>" + item.unit + "</td>" +
        "<td>" + rangeText(item) + "</td>" +
        '<td class="status ' + cls + '">' + status + "</td>" +
        "</tr>";
    }
    ocrTbody.innerHTML = html;
    ocrTableWrap.hidden = false;
  }

  // 打开页面后自动开始识别
  startAutoOcr();
})();
