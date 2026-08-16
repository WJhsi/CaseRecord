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

  // 删除病例（自定义确认弹窗：遮罩变暗 + 5 秒倒计时 + 输入「我确认删除」）
  var deleteBtn = $("btn-delete-case");
  var deleteMask = $("delete-mask");
  var deleteConfirm = $("delete-confirm");
  var deleteCancel = $("delete-cancel");
  var deleteCancelX = $("delete-cancel-x");
  var deleteVerify = $("delete-verify");
  var COUNTDOWN = 5;
  var countdownTimer = null;
  var countdownDone = false;

  function updateConfirmState() {
    var typed = deleteVerify && deleteVerify.value.trim() === "我确认删除";
    deleteConfirm.disabled = !(countdownDone && typed);
  }

  function openDeleteModal() {
    deleteMask.hidden = false;
    document.body.style.overflow = "hidden";

    if (deleteVerify) deleteVerify.value = "";
    countdownDone = false;
    updateConfirmState();

    var left = COUNTDOWN;
    deleteConfirm.textContent = "确认删除（" + left + "s）";
    clearInterval(countdownTimer);
    countdownTimer = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(countdownTimer);
        countdownDone = true;
        deleteConfirm.textContent = "确认删除";
        updateConfirmState();
      } else {
        deleteConfirm.textContent = "确认删除（" + left + "s）";
      }
    }, 1000);
  }

  function closeDeleteModal() {
    clearInterval(countdownTimer);
    deleteMask.hidden = true;
    document.body.style.overflow = "";
  }

  function doDelete() {
    var list = readCases();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(c.id)) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;
    list.splice(idx, 1);
    localStorage.setItem(CASES_KEY, JSON.stringify(list));
    window.location.href = "dashboard.html?deleted=1";
  }

  if (deleteVerify) deleteVerify.addEventListener("input", updateConfirmState);
  if (deleteBtn) deleteBtn.addEventListener("click", openDeleteModal);
  if (deleteCancel) deleteCancel.addEventListener("click", closeDeleteModal);
  if (deleteCancelX) deleteCancelX.addEventListener("click", closeDeleteModal);
  if (deleteMask) {
    deleteMask.addEventListener("click", function (e) {
      if (e.target === deleteMask) closeDeleteModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && deleteMask && !deleteMask.hidden) closeDeleteModal();
  });
  if (deleteConfirm) {
    deleteConfirm.addEventListener("click", function () {
      if (deleteConfirm.disabled) return;
      doDelete();
    });
  }

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

      // 报告类型标签
      var kind = document.createElement("span");
      kind.className = "report-kind-chip";
      kind.textContent = img.kind || "检验报告";

      // 检查方式标签（检查报告时显示，如 CT / MR / 超声）
      if (img.modality) {
        var mod = document.createElement("span");
        mod.className = "report-kind-chip modality-chip";
        mod.textContent = img.modality;
        a.appendChild(mod);
      }

      var arrow = document.createElement("span");
      arrow.className = "report-arrow";
      arrow.textContent = "›";

      a.appendChild(thumb);
      a.appendChild(name);
      a.appendChild(kind);
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

  // 外科治疗方案
  var treatmentEl = $("detail-treatment");
  treatmentEl.innerHTML = "";
  if (c.treatment) {
    var tRow = document.createElement("div");
    tRow.className = "detail-med";
    tRow.innerHTML =
      '<span class="detail-med-name">' + escapeHtml(c.treatment) + "</span>" +
      '<span class="detail-med-usage">' + escapeHtml(c.treatmentNote || "") + "</span>";
    treatmentEl.appendChild(tRow);
  } else {
    treatmentEl.innerHTML = '<span class="detail-empty">未记录治疗方案</span>';
  }
})();
