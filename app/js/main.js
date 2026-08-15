/* ==========================================================
   CaseRecord · 病例档案
   功能：获取并保存患者基本信息（localStorage）
   ========================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "caseRecord.profile";
  var YEAR_BACK = 100; // 出生年可选范围：今年往前 100 年

  var form = document.getElementById("profile-form");
  var toast = document.getElementById("toast");
  var ageHint = document.getElementById("age-hint");
  var summary = document.getElementById("saved-summary");
  var summaryMeta = document.getElementById("summary-meta");
  var clearBtn = document.getElementById("btn-clear");
  var submitBtn = document.getElementById("btn-submit");

  /* ==========================================================
     自定义下拉组件
     与全局样式风格统一，替换原生 <select>
     ========================================================== */

  function createSelect(config) {
    var placeholder = config.placeholder || "";
    var options = config.options || [];
    var value = config.value || "";
    var onChange = config.onChange || function () {};
    var open = false;
    var activeIndex = -1;

    var root = document.createElement("div");
    root.className = "cselect";
    root.innerHTML =
      '<button type="button" class="cselect-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="cselect-value"></span>' +
      '<span class="cselect-caret"></span>' +
      "</button>" +
      '<ul class="cselect-menu" role="listbox" hidden></ul>';

    var trigger = root.querySelector(".cselect-trigger");
    var valueEl = root.querySelector(".cselect-value");
    var menu = root.querySelector(".cselect-menu");

    function getLabel(v) {
      for (var i = 0; i < options.length; i++) {
        if (String(options[i].value) === String(v)) return options[i].label;
      }
      return v || placeholder;
    }

    function renderMenu() {
      var html = "";
      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var selected = String(o.value) === String(value);
        html +=
          '<li role="option" data-index="' + i + '"' + (selected ? ' class="selected"' : "") + ">" +
          "<span>" + o.label + "</span>" +
          (selected ? '<span class="cselect-check">✓</span>' : "") +
          "</li>";
      }
      menu.innerHTML = html;
      valueEl.textContent = value ? getLabel(value) : placeholder;
      valueEl.classList.toggle("placeholder", !value);
    }

    function updateActive() {
      var items = menu.querySelectorAll("li");
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle("active", i === activeIndex);
        if (i === activeIndex) items[i].scrollIntoView({ block: "nearest" });
      }
    }

    function moveActive(delta) {
      var n = options.length;
      if (!n) return;
      activeIndex = (activeIndex + delta + n) % n;
      updateActive();
    }

    function selectIndex(idx) {
      if (!options[idx]) return;
      value = String(options[idx].value);
      onChange(value, options[idx].label);
      renderMenu();
    }

    function setOpen(v) {
      open = v;
      root.classList.toggle("open", v);
      trigger.setAttribute("aria-expanded", String(v));
      if (v) {
        menu.hidden = false;
        activeIndex = -1;
        updateActive();
      } else {
        menu.hidden = true;
      }
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!open);
    });

    menu.addEventListener("click", function (e) {
      var li = e.target.closest("li");
      if (!li) return;
      selectIndex(parseInt(li.getAttribute("data-index"), 10));
      setOpen(false);
      trigger.focus();
    });

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

  /* ---------- 工具函数 ---------- */

  function pad(n) {
    return ("0" + n).slice(-2);
  }

  function daysInMonth(year, month) {
    // month: 1-12
    return new Date(year, month, 0).getDate();
  }

  function calcAge(birth) {
    var b = new Date(birth);
    var now = new Date();
    var age = now.getFullYear() - b.getFullYear();
    var m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  }

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

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

  /* ---------- 下拉实例 ---------- */

  var birthYear = createSelect({
    placeholder: "年",
    onChange: function () {
      birthYear.setError(false);
      renderDays();
      updateAgeHint();
    }
  });
  var birthMonth = createSelect({
    placeholder: "月",
    onChange: function () {
      birthMonth.setError(false);
      renderDays();
      updateAgeHint();
    }
  });
  var birthDay = createSelect({
    placeholder: "日",
    onChange: function () {
      birthDay.setError(false);
      updateAgeHint();
    }
  });
  var blood = createSelect({
    placeholder: "血型",
    value: "未知",
    options: [
      { value: "未知", label: "未知" },
      { value: "A", label: "A 型" },
      { value: "B", label: "B 型" },
      { value: "AB", label: "AB 型" },
      { value: "O", label: "O 型" }
    ],
    onChange: function () {
      blood.setError(false);
    }
  });

  document.getElementById("birth-year-slot").appendChild(birthYear.root);
  document.getElementById("birth-month-slot").appendChild(birthMonth.root);
  document.getElementById("birth-day-slot").appendChild(birthDay.root);
  document.getElementById("blood-slot").appendChild(blood.root);

  /* ---------- 出生日期选项 ---------- */

  function yearOptions() {
    var nowY = new Date().getFullYear();
    var arr = [];
    for (var y = nowY; y >= nowY - YEAR_BACK; y--) {
      arr.push({ value: y, label: y + " 年" });
    }
    return arr;
  }

  function monthOptions() {
    var arr = [];
    for (var m = 1; m <= 12; m++) {
      arr.push({ value: m, label: m + " 月" });
    }
    return arr;
  }

  function renderDays() {
    var y = birthYear.getValue() ? parseInt(birthYear.getValue(), 10) : 2000;
    var m = birthMonth.getValue() ? parseInt(birthMonth.getValue(), 10) : 1;
    var dim = daysInMonth(y, m);
    var arr = [];
    for (var d = 1; d <= dim; d++) {
      arr.push({ value: d, label: d + " 日" });
    }
    birthDay.setOptions(arr);
  }

  function getBirthValue() {
    var y = birthYear.getValue();
    var m = birthMonth.getValue();
    var d = birthDay.getValue();
    if (!y || !m || !d) return "";
    return y + "-" + pad(m) + "-" + pad(d);
  }

  function updateAgeHint() {
    var b = getBirthValue();
    if (b) {
      ageHint.textContent = "年龄 " + calcAge(b) + " 岁";
    } else {
      ageHint.textContent = "";
    }
  }

  /* ---------- 表单回填 ---------- */

  function fillForm(p) {
    if (!p) return;
    form.name.value = p.name || "";
    var g = document.querySelector('input[name="gender"][value="' + p.gender + '"]');
    if (g) g.checked = true;

    if (p.birth) {
      var parts = p.birth.split("-");
      birthYear.setValue(parts[0]);
      birthMonth.setValue(parseInt(parts[1], 10));
      renderDays();
      birthDay.setValue(parseInt(parts[2], 10));
    } else {
      birthYear.setValue("");
      birthMonth.setValue("");
      renderDays();
    }

    form.height.value = p.height || "";
    form.weight.value = p.weight || "";
    blood.setValue(p.blood || "未知");
    form.history.value = p.history || "";
    form.allergy.value = p.allergy || "";
    form.notes.value = p.notes || "";
    updateAgeHint();
  }

  /* ---------- 摘要显示 ---------- */

  function updateSummary(p) {
    if (!p) {
      summary.hidden = true;
      submitBtn.textContent = "保存档案";
      return;
    }
    var parts = [p.name || "未命名"];
    if (p.gender) parts.push(p.gender);
    if (p.birth) {
      var d = p.birth;
      if (p.age != null) d += "（" + p.age + " 岁）";
      parts.push(d);
    }
    if (p.blood && p.blood !== "未知") parts.push(p.blood + " 型");
    summaryMeta.textContent = parts.join(" · ");
    summary.hidden = false;
    submitBtn.textContent = "更新档案";
  }

  /* ---------- 收集与校验 ---------- */

  function collect() {
    var p = {
      name: form.name.value.trim(),
      gender: (document.querySelector('input[name="gender"]:checked') || {}).value || "",
      birth: getBirthValue(),
      height: form.height.value.trim(),
      weight: form.weight.value.trim(),
      blood: blood.getValue() || "未知",
      history: form.history.value.trim(),
      allergy: form.allergy.value.trim(),
      notes: form.notes.value.trim(),
      savedAt: new Date().toISOString()
    };
    if (p.birth) p.age = calcAge(p.birth);
    return p;
  }

  function validate(p) {
    var ok = true;

    // 必填：姓名、性别
    markError(form.name, !p.name);
    if (!p.name) ok = false;

    if (!p.gender) ok = false;

    // 必填：出生日期（年 / 月 / 日 三项齐全）
    var birthBad = !p.birth || isNaN(new Date(p.birth).getTime());
    birthYear.setError(birthBad);
    birthMonth.setError(birthBad);
    birthDay.setError(birthBad);
    if (birthBad) ok = false;

    // 选填但需校验格式：身高、体重
    if (p.height && (isNaN(p.height) || +p.height < 40 || +p.height > 250)) {
      markError(form.height, true);
      ok = false;
    } else {
      markError(form.height, false);
    }

    if (p.weight && (isNaN(p.weight) || +p.weight < 1 || +p.weight > 300)) {
      markError(form.weight, true);
      ok = false;
    } else {
      markError(form.weight, false);
    }

    return ok;
  }

  /* ---------- 事件 ---------- */

  // 输入时清除错误状态
  form.addEventListener("input", function (e) {
    if (e.target.classList) e.target.classList.remove("error");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var p = collect();
    if (!validate(p)) {
      showToast("请检查必填项和格式", "err");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    updateSummary(p);
    showToast("档案已保存 ✓");
  });

  clearBtn.addEventListener("click", function () {
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    birthYear.setValue("");
    birthMonth.setValue("");
    renderDays();
    blood.setValue("未知");
    updateAgeHint();
    updateSummary(null);
    showToast("本地档案已清除");
  });

  /* ---------- 初始化 ---------- */

  birthYear.setOptions(yearOptions());
  birthMonth.setOptions(monthOptions());
  renderDays();

  var saved = readSaved();
  fillForm(saved);
  updateSummary(saved);
})();
