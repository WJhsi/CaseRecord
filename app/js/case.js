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

  /* ==========================================================
     自定义下拉组件（与全局样式统一）
     ========================================================== */

  function createSelect(config) {
    var placeholder = config.placeholder || "";
    var options = config.options || [];
    var value = config.value || "";
    var onChange = config.onChange || function () {};
    var searchable = !!config.searchable;
    var open = false;
    var activeIndex = -1;
    var query = "";
    var filtered = options.slice();

    function esc(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    var root = document.createElement("div");
    root.className = "cselect";
    root.innerHTML =
      '<button type="button" class="cselect-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="cselect-value"></span>' +
      '<span class="cselect-caret"></span>' +
      "</button>" +
      '<div class="cselect-menu has-options" role="listbox" hidden>' +
      (searchable
        ? '<li class="cselect-search-li" role="none"><input type="text" class="cselect-search" placeholder="搜索病情，或直接输入自定义…"></li>' +
          '<li class="cselect-custom" role="option" hidden><span>使用“<b></b>”</span></li>'
        : "") +
      '<div class="cselect-options"></div>' +
      "</div>";

    var trigger = root.querySelector(".cselect-trigger");
    var valueEl = root.querySelector(".cselect-value");
    var menu = root.querySelector(".cselect-menu");
    var searchInput = searchable ? menu.querySelector(".cselect-search") : null;
    var customEl = searchable ? menu.querySelector(".cselect-custom") : null;

    function getLabel(v) {
      for (var i = 0; i < options.length; i++) {
        if (String(options[i].value) === String(v)) return options[i].label;
      }
      return v || placeholder;
    }

    function renderOptions() {
      // 移除旧选项，保留搜索/自定义行
      var box = menu.querySelector(".cselect-options");
      var olds = box.querySelectorAll("li[data-value]");
      for (var k = 0; k < olds.length; k++) olds[k].remove();

      var html = "";
      for (var i = 0; i < filtered.length; i++) {
        var o = filtered[i];
        var selected = String(o.value) === String(value);
        var aliasHtml = o.alias ? '<span class="cselect-alias">/' + esc(o.alias) + "</span>" : "";
        html +=
          '<li role="option" data-value="' + esc(o.value) + '"' + (selected ? ' class="selected"' : "") + ">" +
          '<span class="cselect-label"><span>' + esc(o.label) + "</span>" + aliasHtml + "</span>" +
          (selected ? '<span class="cselect-check">✓</span>' : "") +
          "</li>";
      }
      box.insertAdjacentHTML("beforeend", html);
      updateCustom();
    }

    function applyFilter() {
      query = searchInput ? searchInput.value.trim() : "";
      var q = query.toLowerCase();
      if (!q) {
        filtered = options.slice();
      } else {
        filtered = options.filter(function (o) {
          return (
            o.label.toLowerCase().indexOf(q) > -1 ||
            String(o.value).toLowerCase().indexOf(q) > -1 ||
            (o.alias && o.alias.toLowerCase().indexOf(q) > -1)
          );
        });
      }
      renderOptions();
    }

    function updateCustom() {
      if (!customEl) return;
      var exact = filtered.some(function (o) {
        return String(o.value) === query || o.label === query;
      });
      var show = query !== "" && !exact;
      customEl.hidden = !show;
      if (show) customEl.querySelector("b").textContent = query;
    }

    function selectValue(v, label) {
      value = String(v);
      onChange(value, label || v);
      renderMenu();
      setOpen(false);
      trigger.focus();
    }

    function renderMenu() {
      if (searchInput && !open) {
        searchInput.value = "";
        applyFilter();
      } else {
        renderOptions();
      }
      valueEl.textContent = value ? getLabel(value) : placeholder;
      valueEl.classList.toggle("placeholder", !value);
    }

    function updateActive() {
      var items = menu.querySelectorAll("li[data-value]");
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle("active", i === activeIndex);
        if (i === activeIndex) items[i].scrollIntoView({ block: "nearest" });
      }
    }

    function moveActive(delta) {
      var n = filtered.length;
      if (!n) return;
      activeIndex = (activeIndex + delta + n) % n;
      updateActive();
    }

    function selectIndex(idx) {
      if (!filtered[idx]) return;
      selectValue(filtered[idx].value, filtered[idx].label);
    }

    function setOpen(v) {
      open = v;
      root.classList.toggle("open", v);
      trigger.setAttribute("aria-expanded", String(v));
      if (v) {
        if (searchInput) {
          searchInput.value = "";
          applyFilter();
        } else {
          renderOptions();
        }
        menu.hidden = false;
        activeIndex = -1;
        updateActive();
        if (searchInput) searchInput.focus();
      } else {
        menu.hidden = true;
      }
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!open);
    });

    menu.addEventListener("click", function (e) {
      if (e.target.closest(".cselect-search")) return;
      var custom = e.target.closest(".cselect-custom");
      if (custom && !custom.hidden) {
        selectValue(query, query);
        return;
      }
      var li = e.target.closest("li[data-value]");
      if (!li) return;
      selectValue(li.getAttribute("data-value"), li.querySelector("span").textContent);
    });

    if (searchInput) {
      searchInput.addEventListener("input", applyFilter);
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (customEl && !customEl.hidden) {
            selectValue(query, query);
            return;
          }
          var first = menu.querySelector(".cselect-options li[data-value]");
          if (first) {
            selectValue(first.getAttribute("data-value"), first.querySelector("span").textContent);
          }
        } else if (e.key === "Escape") {
          setOpen(false);
          trigger.focus();
        }
      });
    }

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        moveActive(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (open) {
          if (activeIndex >= 0) selectIndex(activeIndex);
          setOpen(false);
        } else {
          setOpen(true);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    });

    document.addEventListener("click", function (e) {
      if (open && !root.contains(e.target)) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) setOpen(false);
    });

    renderMenu();

    return {
      root: root,
      getValue: function () {
        return value;
      },
      setValue: function (v) {
        value = v ? String(v) : "";
        renderMenu();
      },
      setOptions: function (arr) {
        options = arr || [];
        var found = false;
        for (var i = 0; i < options.length; i++) {
          if (String(options[i].value) === String(value)) {
            found = true;
            break;
          }
        }
        if (!found) value = "";
        renderMenu();
      },
      setError: function (bad) {
        root.classList.toggle("error", !!bad);
      }
    };
  }

  /* ---------- 下拉病情 ---------- */

  var illness = createSelect({
    placeholder: "选择病情",
    searchable: true,
    options: [
      // 呼吸系统
      { value: "急性上呼吸道感染", label: "急性上呼吸道感染", alias: "感冒" },
      { value: "流行性感冒", label: "流行性感冒", alias: "流感" },
      { value: "急性支气管炎", label: "急性支气管炎", alias: "气管炎" },
      { value: "肺炎", label: "肺炎", alias: "肺部感染" },
      { value: "支气管哮喘", label: "支气管哮喘", alias: "哮喘" },
      { value: "变应性鼻炎", label: "变应性鼻炎", alias: "过敏性鼻炎" },
      { value: "慢性阻塞性肺疾病", label: "慢性阻塞性肺疾病", alias: "慢阻肺" },
      // 心血管系统
      { value: "原发性高血压", label: "原发性高血压", alias: "高血压" },
      { value: "冠状动脉粥样硬化性心脏病", label: "冠状动脉粥样硬化性心脏病", alias: "冠心病" },
      { value: "心律失常", label: "心律失常", alias: "心律不齐" },
      { value: "高脂血症", label: "高脂血症", alias: "高血脂" },
      { value: "心力衰竭", label: "心力衰竭", alias: "心衰" },
      // 消化系统
      { value: "慢性胃炎", label: "慢性胃炎", alias: "胃炎" },
      { value: "消化性溃疡", label: "消化性溃疡", alias: "胃溃疡" },
      { value: "急性胃肠炎", label: "急性胃肠炎", alias: "肠胃炎" },
      { value: "功能性消化不良", label: "功能性消化不良", alias: "消化不良" },
      { value: "便秘", label: "便秘", alias: "排便困难" },
      { value: "病毒性肝炎", label: "病毒性肝炎", alias: "肝炎" },
      // 内分泌与代谢
      { value: "2型糖尿病", label: "2型糖尿病", alias: "糖尿病" },
      { value: "甲状腺功能亢进症", label: "甲状腺功能亢进症", alias: "甲亢" },
      { value: "甲状腺功能减退症", label: "甲状腺功能减退症", alias: "甲减" },
      { value: "痛风", label: "痛风", alias: "痛风" },
      // 神经系统
      { value: "偏头痛", label: "偏头痛", alias: "偏头痛" },
      { value: "紧张性头痛", label: "紧张性头痛", alias: "紧张性头痛" },
      { value: "失眠症", label: "失眠症", alias: "失眠" },
      { value: "眩晕", label: "眩晕", alias: "头晕" },
      // 泌尿系统
      { value: "泌尿道感染", label: "泌尿道感染", alias: "尿路感染" },
      { value: "泌尿系结石", label: "泌尿系结石", alias: "尿路结石" },
      // 骨骼肌肉
      { value: "颈椎病", label: "颈椎病", alias: "颈椎病" },
      { value: "腰椎间盘突出症", label: "腰椎间盘突出症", alias: "腰椎间盘突出" },
      { value: "骨关节炎", label: "骨关节炎", alias: "关节炎" },
      { value: "软组织损伤", label: "软组织损伤", alias: "扭伤" },
      { value: "骨折", label: "骨折", alias: "骨折" },
      // 皮肤
      { value: "湿疹", label: "湿疹", alias: "湿疹" },
      { value: "荨麻疹", label: "荨麻疹", alias: "风疹块" },
      { value: "痤疮", label: "痤疮", alias: "青春痘" },
      { value: "接触性皮炎", label: "接触性皮炎", alias: "皮炎" },
      // 其他
      { value: "创伤", label: "创伤", alias: "外伤" },
      { value: "复诊", label: "复诊", alias: "复查" },
      { value: "健康体检", label: "健康体检", alias: "体检" }
    ],
    onChange: function () {
      illness.setError(false);
    }
  });
  document.getElementById("illness-slot").appendChild(illness.root);

  /* ---------- 报告类型（检验 / 检查） ---------- */

  var reportKind = createSelect({
    placeholder: "报告类型",
    value: "检验报告",
    options: [
      { value: "检验报告", label: "检验报告" },
      { value: "检查报告", label: "检查报告" }
    ],
    onChange: function () {}
  });
  document.getElementById("report-kind-slot").appendChild(reportKind.root);

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
        files.push({
          name: f.name,
          type: f.type,
          dataUrl: e.target.result,
          kind: reportKind.getValue() || "检验报告"
        });
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
      var row = document.createElement("div");
      row.className = "report-row";

      // 缩略图
      var thumb = document.createElement("div");
      thumb.className = "report-thumb";
      if (f.type && f.type.indexOf("image/") === 0) {
        var im = document.createElement("img");
        im.src = f.dataUrl;
        im.alt = f.name;
        thumb.appendChild(im);
      } else {
        thumb.innerHTML = '<span class="report-thumb-pdf">PDF</span>';
      }

      // 文件名
      var name = document.createElement("div");
      name.className = "report-name";
      name.textContent = f.name;

      // 报告类型标签
      var kind = document.createElement("span");
      kind.className = "report-kind-chip";
      kind.textContent = f.kind || "检验报告";

      // 移除按钮
      var del = document.createElement("button");
      del.type = "button";
      del.className = "report-remove";
      del.setAttribute("data-i", i);
      del.title = "移除";
      del.textContent = "×";

      row.appendChild(thumb);
      row.appendChild(name);
      row.appendChild(kind);
      row.appendChild(del);
      uploadPreview.appendChild(row);
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
    var illnessVal = illness.getValue() || "";
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
      cases[idx].illness = illnessVal;
      cases[idx].condition = condition;
      cases[idx].images = imageData;
      cases[idx].meds = meds;
      cases[idx].updatedAt = new Date().toISOString();
      savedId = cases[idx].id;
    } else {
      var newCase = {
        id: Date.now(),
        illness: illnessVal,
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
    illness.setValue(editing.illness || "");
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
