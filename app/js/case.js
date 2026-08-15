/* ==========================================================
   CaseRecord · 添加 / 编辑病例
   功能：输入病情、上传影像报告、录入药物，保存到 localStorage
   支持 ?id=xxx 编辑已有病例；保存后直达病例详情页
   ========================================================== */
(function () {
  "use strict";

  var CASES_KEY = "caseRecord.cases";
  var MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  var ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "pdf"];

  var form = document.getElementById("case-form");
  var toast = document.getElementById("toast");
  var fileInput = document.getElementById("report-files");
  var uploadTrigger = document.getElementById("upload-trigger");
  var uploadPreview = document.getElementById("upload-preview");
  var medList = document.getElementById("med-list");
  var addMedBtn = document.getElementById("add-med");
  var pageTitle = document.getElementById("page-title");
  var pageSub = document.getElementById("page-sub");
  var backLink = document.getElementById("back-link");

  /* ---------- 编辑模式 ---------- */

  var EDIT_ID = null;
  try {
    EDIT_ID = new URLSearchParams(window.location.search).get("id");
  } catch (e) {
    EDIT_ID = null;
  }

  var editing = null;
  if (EDIT_ID) {
    var all = readCases();
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].id) === String(EDIT_ID)) {
        editing = all[i];
        break;
      }
    }
  }

  if (editing) {
    pageTitle.textContent = "编辑病例";
    pageSub.textContent = "修改病情、影像报告与用药记录。";
    backLink.href = "case-detail.html?id=" + editing.id;
  }

  // 编辑模式：预置已有影像
  var files =
    editing && Array.isArray(editing.images) ? editing.images.slice() : [];

  /* ---------- 工具 ---------- */

  function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = "toast " + (type || "ok") + " show";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove("show");
    }, 2800);
  }

  function markError(input, bad) {
    if (bad) {
      input.classList.add("error");
      input.setAttribute("aria-invalid", "true");
    } else {
      input.classList.remove("error");
      input.removeAttribute("aria-invalid");
    }
  }

  function readCases() {
    try {
      var arr = JSON.parse(localStorage.getItem(CASES_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function isAllowed(f) {
    var ext = (f.name.split(".").pop() || "").toLowerCase();
    return ALLOWED_EXT.indexOf(ext) > -1;
  }

  /* ---------- 影像上传 ---------- */

  uploadTrigger.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    var list = Array.prototype.slice.call(fileInput.files);
    var added = 0;
    list.forEach(function (f) {
      if (!isAllowed(f)) {
        showToast("不支持的文件类型：" + f.name, "err");
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        showToast("文件超过 2MB：" + f.name, "err");
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        files.push({ name: f.name, type: f.type, dataUrl: e.target.result });
        renderPreview();
      };
      reader.onerror = function () {
        showToast("读取文件失败：" + f.name, "err");
      };
      reader.readAsDataURL(f);
      added++;
    });
    if (added) showToast("已选择 " + added + " 个文件");
    fileInput.value = ""; // 允许重复选择同一文件
  });

  function renderPreview() {
    uploadPreview.innerHTML = "";
    files.forEach(function (f, i) {
      var box = document.createElement("div");
      box.className = "thumb";

      if (f.type && f.type.indexOf("image/") === 0) {
        box.innerHTML = '<img src="' + f.dataUrl + '" alt="' + f.name + '">';
      } else {
        box.innerHTML = '<div class="thumb-pdf">PDF</div>';
      }

      box.innerHTML +=
        '<div class="thumb-name">' + f.name + "</div>" +
        '<button type="button" class="thumb-remove" data-i="' + i + '" title="移除">×</button>';
      uploadPreview.appendChild(box);
    });
  }

  uploadPreview.addEventListener("click", function (e) {
    var btn = e.target.closest(".thumb-remove");
    if (!btn) return;
    files.splice(parseInt(btn.getAttribute("data-i"), 10), 1);
    renderPreview();
  });

  /* ---------- 药物行 ---------- */

  function addMedRow(name, usage) {
    var row = document.createElement("div");
    row.className = "med-row";
    row.innerHTML =
      '<div class="field">' +
      '<label>药物名称</label>' +
      '<input type="text" class="med-name" placeholder="如：阿莫西林胶囊" value="' + (name || "") + '">' +
      "</div>" +
      '<div class="field">' +
      "<label>用法用量</label>" +
      '<input type="text" class="med-usage" placeholder="如：每次1粒，每日3次，饭后" value="' + (usage || "") + '">' +
      "</div>" +
      '<button type="button" class="med-remove" title="删除此药物">×</button>';
    medList.appendChild(row);
  }

  addMedBtn.addEventListener("click", function () {
    addMedRow();
  });

  medList.addEventListener("click", function (e) {
    if (!e.target.closest(".med-remove")) return;
    var row = e.target.closest(".med-row");
    if (medList.children.length > 1) {
      row.remove();
    } else {
      // 至少保留一行，仅清空内容
      row.querySelector(".med-name").value = "";
      row.querySelector(".med-usage").value = "";
    }
  });

  /* ---------- 提交 ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var condition = form.condition.value.trim();
    markError(form.condition, !condition);
    if (!condition) {
      showToast("请填写病情描述", "err");
      return;
    }

    var meds = [];
    Array.prototype.forEach.call(medList.querySelectorAll(".med-row"), function (row) {
      var name = row.querySelector(".med-name").value.trim();
      var usage = row.querySelector(".med-usage").value.trim();
      if (name || usage) meds.push({ name: name, usage: usage });
    });

    var cases = readCases();
    var savedId;
    var imageData = files.map(function (f) {
      return { name: f.name, type: f.type, dataUrl: f.dataUrl };
    });

    if (editing) {
      var idx = -1;
      for (var j = 0; j < cases.length; j++) {
        if (String(cases[j].id) === String(editing.id)) {
          idx = j;
          break;
        }
      }
      if (idx === -1) {
        showToast("病例不存在，请返回重试", "err");
        return;
      }
      cases[idx].condition = condition;
      cases[idx].images = imageData;
      cases[idx].meds = meds;
      cases[idx].updatedAt = new Date().toISOString();
      savedId = cases[idx].id;
    } else {
      var newCase = {
        id: Date.now(),
        condition: condition,
        images: imageData,
        meds: meds,
        createdAt: new Date().toISOString()
      };
      cases.push(newCase);
      savedId = newCase.id;
    }

    try {
      localStorage.setItem(CASES_KEY, JSON.stringify(cases));
    } catch (err) {
      showToast("存储空间不足，请移除部分影像文件", "err");
      return;
    }

    showToast(editing ? "病例已更新 ✓" : "病例已保存 ✓");
    // 保存后直达病例详情页
    setTimeout(function () {
      window.location.href = "case-detail.html?id=" + savedId;
    }, 700);
  });

  // 输入时清除错误状态
  form.addEventListener("input", function (e) {
    if (e.target.classList) e.target.classList.remove("error");
  });

  /* ---------- 初始化 ---------- */

  if (editing) {
    form.condition.value = editing.condition || "";
    renderPreview();
    if (editing.meds && editing.meds.length) {
      editing.meds.forEach(function (m) {
        addMedRow(m.name, m.usage);
      });
    } else {
      addMedRow();
    }
  } else {
    addMedRow();
  }
})();
