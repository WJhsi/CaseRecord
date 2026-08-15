/* ==========================================================
   CaseRecord · 病例详情页
   根据 URL 参数 id 渲染对应病例，铺满整屏
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

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 定位病例 ---------- */

  var id = null;
  try {
    id = new URLSearchParams(window.location.search).get("id");
  } catch (e) {
    id = null;
  }

  var list = readCases();
  var c = null;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id)) {
      c = list[i];
      break;
    }
  }
  if (!c) {
    window.location.replace("dashboard.html");
    return;
  }

  /* ---------- 渲染 ---------- */

  $("detail-date").textContent =
    "记录于 " + new Date(c.createdAt).toLocaleString("zh-CN");

  // 编辑入口
  var editBtn = $("btn-edit-case");
  if (editBtn) editBtn.href = "case.html?id=" + c.id;

  $("detail-cond").textContent = c.condition || "—";

  // 影像报告
  var imagesEl = $("detail-images");
  imagesEl.innerHTML = "";
  if (c.images && c.images.length) {
    c.images.forEach(function (img) {
      var a = document.createElement("a");
      a.href = img.dataUrl;
      a.target = "_blank";
      a.rel = "noopener";
      if (img.type && img.type.indexOf("image/") === 0) {
        var im = document.createElement("img");
        im.src = img.dataUrl;
        im.alt = img.name || "影像";
        im.title = img.name;
        a.appendChild(im);
      } else {
        a.className = "detail-pdf";
        a.textContent = "📄 " + (img.name || "PDF 报告");
      }
      imagesEl.appendChild(a);
    });
  } else {
    imagesEl.innerHTML = '<span class="detail-empty">无影像报告</span>';
  }

  // 药物
  var medsEl = $("detail-meds");
  medsEl.innerHTML = "";
  if (c.meds && c.meds.length) {
    c.meds.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "detail-med";
      row.innerHTML =
        '<span class="detail-med-name">' + escapeHtml(m.name || "未命名") + "</span>" +
        '<span class="detail-med-usage">' + escapeHtml(m.usage || "") + "</span>";
      medsEl.appendChild(row);
    });
  } else {
    medsEl.innerHTML = '<span class="detail-empty">未记录药物</span>';
  }
})();
