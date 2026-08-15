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
  var birthYear = document.getElementById("birth-year");
  var birthMonth = document.getElementById("birth-month");
  var birthDay = document.getElementById("birth-day");
  var ageHint = document.getElementById("age-hint");
  var summary = document.getElementById("saved-summary");
  var summaryMeta = document.getElementById("summary-meta");
  var clearBtn = document.getElementById("btn-clear");
  var submitBtn = document.getElementById("btn-submit");

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

  /* ---------- 出生日期三下拉 ---------- */

  function initBirthSelects() {
    // 年：今年往前 YEAR_BACK 年
    var nowY = new Date().getFullYear();
    var yOpts = '<option value="">年</option>';
    for (var y = nowY; y >= nowY - YEAR_BACK; y--) {
      yOpts += '<option value="' + y + '">' + y + ' 年</option>';
    }
    birthYear.innerHTML = yOpts;

    // 月：1-12
    var mOpts = '<option value="">月</option>';
    for (var m = 1; m <= 12; m++) {
      mOpts += '<option value="' + m + '">' + m + ' 月</option>';
    }
    birthMonth.innerHTML = mOpts;

    renderDays();
  }

  function renderDays() {
    var y = birthYear.value ? parseInt(birthYear.value, 10) : 2000;
    var m = birthMonth.value ? parseInt(birthMonth.value, 10) : 1;
    var dim = daysInMonth(y, m);
    var cur = birthDay.value ? parseInt(birthDay.value, 10) : null;

    var dOpts = '<option value="">日</option>';
    for (var d = 1; d <= dim; d++) {
      var sel = cur === d ? " selected" : "";
      dOpts += '<option value="' + d + '"' + sel + ">" + d + " 日</option>";
    }
    birthDay.innerHTML = dOpts;
  }

  function getBirthValue() {
    if (!birthYear.value || !birthMonth.value || !birthDay.value) return "";
    return birthYear.value + "-" + pad(birthMonth.value) + "-" + pad(birthDay.value);
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

    // 出生日期：拆分为 年 / 月 / 日
    if (p.birth) {
      var parts = p.birth.split("-");
      birthYear.value = parts[0] || "";
      birthMonth.value = parseInt(parts[1], 10) || "";
      renderDays();
      birthDay.value = parseInt(parts[2], 10) || "";
    } else {
      birthYear.value = "";
      birthMonth.value = "";
      renderDays();
    }

    form.height.value = p.height || "";
    form.weight.value = p.weight || "";
    form.blood.value = p.blood || "未知";
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
      blood: form.blood.value || "未知",
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
    markError(birthYear, birthBad);
    markError(birthMonth, birthBad);
    markError(birthDay, birthBad);
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

  birthYear.addEventListener("change", function () {
    renderDays();
    updateAgeHint();
  });
  birthMonth.addEventListener("change", function () {
    renderDays();
    updateAgeHint();
  });
  birthDay.addEventListener("change", updateAgeHint);

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
    form.blood.value = "未知";
    birthYear.value = "";
    birthMonth.value = "";
    renderDays();
    updateAgeHint();
    updateSummary(null);
    showToast("本地档案已清除");
  });

  /* ---------- 初始化 ---------- */

  initBirthSelects();

  var saved = readSaved();
  fillForm(saved);
  updateSummary(saved);
})();
