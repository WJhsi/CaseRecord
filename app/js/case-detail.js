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

  // 下拉病情类型
  var illnessEl = $("detail-illness");
  if (c.illness && c.illness !== "未分类") {
    illnessEl.textContent = "病情类型：" + c.illness;
    illnessEl.hidden = false;
  }

  $("detail-cond").textContent = c.condition || "—";

  // 检验报告 / 检查报告：横向块列表，点击进入报告详情页
  var imagesEl = $("detail-images");
  imagesEl.innerHTML = "";
  if (c.images && c.images.length) {
    var listEl = document.createElement("div");
    listEl.className = "report-list";

    c.images.forEach(function (img, idx) {
      var a = document.createElement("a");
      a.className = "report-row";
      a.href = "report-detail.html?caseId=" + c.id + "&idx=" + idx;
      a.title = "查看报告";

      var thumb = document.createElement("div");
      thumb.className = "report-thumb";
      if (img.type && img.type.indexOf("image/") === 0) {
        var im = document.createElement("img");
        im.src = img.dataUrl;
        im.alt = img.name || "报告";
        thumb.appendChild(im);
      } else {
        thumb.innerHTML = '<span class="report-thumb-pdf">PDF</span>';
      }

      var name = document.createElement("div");
      name.className = "report-name";
      name.textContent = img.name || "报告 " + (idx + 1);

      var arrow = document.createElement("span");
      arrow.className = "report-arrow";
      arrow.textContent = "›";

      a.appendChild(thumb);
      a.appendChild(name);
      a.appendChild(arrow);
      listEl.appendChild(a);
    });

    imagesEl.appendChild(listEl);
  } else {
    imagesEl.innerHTML = '<span class="detail-empty">无检验 / 检查报告</span>';
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
