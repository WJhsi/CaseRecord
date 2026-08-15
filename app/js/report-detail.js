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
})();
