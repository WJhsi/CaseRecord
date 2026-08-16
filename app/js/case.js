/* ==========================================================
   CaseRecord · 添加 / 编辑病例
   功能：输入病情、上传影像报告、录入药物，数据存本地 JSON 文件
   支持 ?id=xxx 编辑已有病例；保存后直达病例详情页
   ========================================================== */
(function () {
  "use strict";

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

  /* ---------- 编辑模式（异步读取 JSON 文件） ---------- */

  var EDIT_ID = null;
  try {
    EDIT_ID = new URLSearchParams(window.location.search).get("id");
  } catch (e) {
    EDIT_ID = null;
  }

  var editing = null;
  var files = []; // 编辑模式：预置已有影像

  function initEdit() {
    if (!EDIT_ID) return Promise.resolve();
    return Store.getCase(EDIT_ID).then(function (c) {
      if (!c) {
        showToast("病例不存在，请返回重试", "err");
        return;
      }
      editing = c;
      pageTitle.textContent = "编辑病例";
      pageSub.textContent = "修改病情、影像报告与用药记录。";
      backLink.href = "case-detail.html?id=" + editing.id;
      files = Array.isArray(editing.images) ? editing.images.slice() : [];
      // 回填表单
      form.condition.value = editing.condition || "";
      illness.setValue(editing.illness || "");
      treatment.setValue(editing.treatment || "");
      form["treatment-note"].value = editing.treatmentNote || "";
      renderPreview();
      if (editing.meds && editing.meds.length) {
        editing.meds.forEach(function (m) {
          addMedRow(m.name, m.usage);
        });
      }
      updateModalityVisibility();
    });
  }

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
    var searchPlaceholder = config.searchPlaceholder || "搜索或自定义输入…";
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
        ? '<li class="cselect-search-li" role="none"><input type="text" class="cselect-search" placeholder="' + searchPlaceholder + '"></li>' +
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
      },
      setDisabled: function (disabled) {
        root.classList.toggle("disabled", !!disabled);
        trigger.disabled = !!disabled;
      }
    };
  }

  /* ---------- 下拉病情 ---------- */

  var illness = createSelect({
    placeholder: "选择病情",
    searchable: true,
    searchPlaceholder: "搜索病情，或直接输入自定义…",
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
    onChange: function () {
      reportKind.setError(false);
      updateModalityVisibility();
    }
  });
  document.getElementById("report-kind-slot").appendChild(reportKind.root);

  /* ---------- 检查方式（仅检查报告时显示：DR / CT / MR / 超声等） ---------- */

  var MODALITY_OPTIONS = [
    { value: "DR", label: "DR（X光）" },
    { value: "CT", label: "CT" },
    { value: "MR", label: "MR（磁共振）" },
    { value: "超声", label: "超声" },
    { value: "心电图", label: "心电图" },
    { value: "内镜", label: "内镜" },
    { value: "病理", label: "病理" }
  ];

  var modality = createSelect({
    placeholder: "检查方式…",
    searchable: true,
    searchPlaceholder: "搜索检查方式…",
    options: MODALITY_OPTIONS,
    onChange: function () {
      modality.setError(false);
    }
  });
  var modalitySlot = document.getElementById("modality-slot");
  modalitySlot.appendChild(modality.root);

  function updateModalityVisibility() {
    // 检查报告：启用检查方式；检验报告：置灰禁用并清空
    var enabled = reportKind.getValue() === "检查报告";
    modality.setDisabled(!enabled);
    if (!enabled) modality.setValue("");
  }

  /* ---------- 外科治疗方案 ---------- */

  var TREATMENT_OPTIONS = [
    { value: "无", label: "无" },
    { value: "手术", label: "手术" },
    { value: "清创缝合", label: "清创缝合" },
    { value: "换药", label: "换药" },
    { value: "引流", label: "引流" },
    { value: "石膏固定", label: "石膏固定" },
    { value: "牵引", label: "牵引" },
    { value: "穿刺抽液", label: "穿刺抽液" },
    { value: "理疗", label: "理疗" },
    { value: "保守治疗", label: "保守治疗" }
  ];

  var treatment = createSelect({
    placeholder: "选择治疗方案…",
    searchable: true,
    value: "无",
    options: TREATMENT_OPTIONS,
    onChange: function () {
      treatment.setError(false);
    }
  });
  document.getElementById("treatment-slot").appendChild(treatment.root);

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
          kind: reportKind.getValue() || "检验报告",
          modality: reportKind.getValue() === "检查报告" ? (modality.getValue() || "") : ""
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
        im.alt = "报告";
        thumb.appendChild(im);
      } else {
        thumb.innerHTML = '<span class="report-thumb-pdf">PDF</span>';
      }

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
      row.appendChild(kind);
      row.appendChild(del);
      uploadPreview.appendChild(row);
    });
  }

  uploadPreview.addEventListener("click", function (e) {
    var btn = e.target.closest(".report-remove, .thumb-remove");
    if (!btn) return;
    files.splice(parseInt(btn.getAttribute("data-i"), 10), 1);
    renderPreview();
    showToast("已移除该报告 ✓");
  });

  /* ---------- 药物行 ---------- */

  // 用法用量四段下拉：一日 X 次 / 每次 X / 单位 / 用法
  var FREQ_OPTIONS = [
    { value: "1", label: "1次" },
    { value: "2", label: "2次" },
    { value: "3", label: "3次" },
    { value: "4", label: "4次" }
  ];
  var AMOUNT_OPTIONS = [
    { value: "0.5", label: "0.5" },
    { value: "1", label: "1" },
    { value: "1.5", label: "1.5" },
    { value: "2", label: "2" },
    { value: "3", label: "3" }
  ];
  var UNIT_OPTIONS = [
    { value: "粒", label: "粒" },
    { value: "片", label: "片" },
    { value: "袋", label: "袋" },
    { value: "支", label: "支" },
    { value: "ml", label: "ml" },
    { value: "丸", label: "丸" },
    { value: "滴", label: "滴" },
    { value: "包", label: "包" }
  ];
  var METHOD_OPTIONS = [
    { value: "饭后服用", label: "饭后服用" },
    { value: "饭前服用", label: "饭前服用" },
    { value: "睡前服用", label: "睡前服用" },
    { value: "空腹服用", label: "空腹服用" },
    { value: "随餐服用", label: "随餐服用" },
    { value: "外用", label: "外用" }
  ];

  // 解析已保存的用法用量字符串回填到四段
  function parseUsage(str) {
    var u = { freq: "", amount: "", unit: "", method: "" };
    if (!str) return u;
    var m1 = str.match(/一日(\d+(?:\.\d+)?)次/);
    if (m1) u.freq = m1[1];
    var m2 = str.match(/每次(\d+(?:\.\d+)?)/);
    if (m2) u.amount = m2[1];
    var m3 = str.match(/每次\d+(?:\.\d+)?(ml|[粒片袋支丸滴包])/);
    if (m3) u.unit = m3[1];
    var m4 = str.match(/，([^，]+)$/);
    if (m4) u.method = m4[1];
    return u;
  }

  // 四段组合成用法用量文本
  function composeUsage(u) {
    var parts = [];
    if (u.freq && u.amount && u.unit) {
      parts.push("一日" + u.freq + "次，每次" + u.amount + u.unit);
    } else if (u.amount && u.unit) {
      parts.push("每次" + u.amount + u.unit);
    } else if (u.freq) {
      parts.push("一日" + u.freq + "次");
    }
    if (u.method) parts.push(u.method);
    return parts.join("，");
  }

  function makeUsageSelect(options, cls, value) {
    var sel = createSelect({
      placeholder: "选择",
      options: options,
      value: value || "",
      onChange: function () {}
    });
    sel.root.classList.add(cls);
    return sel;
  }

  function addMedRow(name, usage) {
    var row = document.createElement("div");
    row.className = "med-row";

    // 药物名称
    var nameField = document.createElement("div");
    nameField.className = "field";
    nameField.innerHTML =
      '<label>药物名称</label>' +
      '<input type="text" class="med-name" placeholder="如：阿莫西林胶囊" value="' + (name || "") + '">';

    // 用法用量：一日X次，每次X单位，用法
    var parsed = parseUsage(usage || "");
    var freqSel = makeUsageSelect(FREQ_OPTIONS, "usage-freq", parsed.freq);
    var amountSel = makeUsageSelect(AMOUNT_OPTIONS, "usage-amount", parsed.amount);
    var unitSel = makeUsageSelect(UNIT_OPTIONS, "usage-unit", parsed.unit);
    var methodSel = makeUsageSelect(METHOD_OPTIONS, "usage-method", parsed.method);

    var usageField = document.createElement("div");
    usageField.className = "field";
    usageField.innerHTML = "<label>用法用量</label>";
    var usageRow = document.createElement("div");
    usageRow.className = "med-usage-row";
    usageRow.appendChild(document.createTextNode("一日"));
    usageRow.appendChild(freqSel.root);
    usageRow.appendChild(document.createTextNode("次，每次"));
    usageRow.appendChild(amountSel.root);
    usageRow.appendChild(unitSel.root);
    usageRow.appendChild(document.createTextNode("，"));
    usageRow.appendChild(methodSel.root);
    usageField.appendChild(usageRow);

    row._usage = { freq: freqSel, amount: amountSel, unit: unitSel, method: methodSel };

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "med-remove";
    removeBtn.title = "删除此药物";
    removeBtn.textContent = "×";

    row.appendChild(nameField);
    row.appendChild(usageField);
    row.appendChild(removeBtn);
    medList.appendChild(row);
  }

  function collectUsage(row) {
    var u = row._usage;
    if (!u) return "";
    return composeUsage({
      freq: u.freq.getValue(),
      amount: u.amount.getValue(),
      unit: u.unit.getValue(),
      method: u.method.getValue()
    });
  }

  addMedBtn.addEventListener("click", function () {
    addMedRow();
    // 自动滚动：新行底部超出视口时向下滑动，保证新行可见
    var rows = medList.querySelectorAll(".med-row");
    var lastRow = rows[rows.length - 1];
    if (lastRow) {
      var rect = lastRow.getBoundingClientRect();
      var overflow = rect.bottom - (window.innerHeight - 80);
      if (overflow > 0) {
        window.scrollBy({ top: overflow + 40, behavior: "smooth" });
      }
    }
  });

  medList.addEventListener("click", function (e) {
    if (!e.target.closest(".med-remove")) return;
    // 允许删除到 0 行（药物可选填）
    e.target.closest(".med-row").remove();
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
      var usage = collectUsage(row);
      if (name || usage) meds.push({ name: name, usage: usage });
    });

    var savedId;
    var illnessVal = illness.getValue() || "";
    var treatmentVal = treatment.getValue() || "";
    var treatmentNote = form["treatment-note"].value.trim();
    var imageData = files.map(function (f) {
      return {
        name: f.name,
        type: f.type,
        dataUrl: f.dataUrl,
        kind: f.kind,
        modality: f.modality
      };
    });

    var nowIso = new Date().toISOString();
    var savedId;
    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "保存中…";
    }

    var doSave = function (caseData) {
      savedId = caseData.id;
      Store.saveCase(savedId, caseData)
        .then(function () {
          showToast(editing ? "病例已更新 ✓" : "病例已保存 ✓");
          // 保存后直达病例详情页
          setTimeout(function () {
            window.location.href = "case-detail.html?id=" + savedId;
          }, 700);
        })
        .catch(function (err) {
          showToast("保存失败：" + (err && err.message ? err.message : err), "err");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = editing ? "更新病例" : "保存病例";
          }
        });
    };

    if (editing) {
      var caseData = editing;
      caseData.illness = illnessVal;
      caseData.condition = condition;
      caseData.images = imageData;
      caseData.meds = meds;
      caseData.treatment = treatmentVal;
      caseData.treatmentNote = treatmentNote;
      caseData.updatedAt = nowIso;
      doSave(caseData);
    } else {
      // 新病例：ID 用日期形式（如 2026-08-15，同一天自动加序号）
      Store.nextCaseId().then(function (newId) {
        doSave({
          id: newId,
          illness: illnessVal,
          condition: condition,
          images: imageData,
          meds: meds,
          treatment: treatmentVal,
          treatmentNote: treatmentNote,
          createdAt: nowIso
        });
      }).catch(function (err) {
        showToast("生成病例编号失败：" + (err && err.message ? err.message : err), "err");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "保存病例";
        }
      });
    }
  });

  // 输入时清除错误状态
  form.addEventListener("input", function (e) {
    if (e.target.classList) e.target.classList.remove("error");
  });

  /* ---------- 初始化 ---------- */
  // 编辑模式从 JSON 文件异步加载回填；非编辑模式直接可用
  Store.migrateOnce()
    .then(function () {
      return initEdit();
    })
    .then(function () {
      // 非编辑模式：默认不显示药物行，点「＋ 添加药物」才添加
      // 初始化报告类型联动（编辑时若为检查报告则显示检查方式）
      if (!EDIT_ID) updateModalityVisibility();
    })
    .catch(function () {
      /* 未通过本地服务器打开时忽略 */
    });
})();
