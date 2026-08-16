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

  /* ---------- AI 大模型配置：模型下拉 ---------- */

  var MODEL_OPTIONS = [
    // OpenAI（支持图片输入）
    { value: "gpt-5.5", label: "GPT-5.5（看图）" },
    { value: "gpt-5.2", label: "GPT-5.2（看图）" },
    { value: "gpt-5", label: "GPT-5（看图）" },
    { value: "gpt-4o", label: "GPT-4o（看图）" },
    // Anthropic Claude（支持图片输入）
    { value: "claude-4.5", label: "Claude 4.5（看图）" },
    { value: "claude-4-5-sonnet", label: "Claude 4.5 Sonnet（看图）" },
    // Google Gemini（支持图片输入）
    { value: "gemini-3-pro", label: "Gemini 3 Pro（看图）" },
    { value: "gemini-3-flash", label: "Gemini 3 Flash（看图）" },
    // xAI（支持图片输入）
    { value: "grok-4", label: "Grok 4（看图）" },
    // Meta（原生多模态）
    { value: "llama-4", label: "Llama 4（看图）" },
    // 阿里通义千问（百炼 DashScope：https://dashscope.aliyuncs.com/compatible-mode/v1）
    { value: "qwen-vl-max", label: "通义千问 VL-Max（qwen-vl-max，看图）" },
    { value: "qwen-vl-plus", label: "通义千问 VL-Plus（qwen-vl-plus，看图）" },
    // 智谱（支持图片输入）
    { value: "glm-4v", label: "智谱 GLM-4V（看图）" }
  ];

  var aiModel = createSelect({
    placeholder: "选择模型…",
    options: MODEL_OPTIONS,
    onChange: function () {
      aiModel.setError(false);
    }
  });

  document.getElementById("ai-model-slot").appendChild(aiModel.root);

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

    // 必填：AI 大模型配置（API 地址 / Key / 模型，存本地 JSON）
    var aiBase = form["ai-base"].value.trim();
    var aiKey = form["ai-key"].value.trim();
    var aiModelVal = aiModel.getValue();
    var aiBad = !aiBase || !aiKey || !aiModelVal;
    markError(form["ai-base"], aiBad);
    markError(form["ai-key"], aiBad);
    aiModel.setError(aiBad);
    if (aiBad) ok = false;

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

    // 收集 AI 配置（存入本地 JSON，不存浏览器）
    var aiCfg = {
      base: form["ai-base"].value.trim(),
      key: form["ai-key"].value.trim(),
      model: aiModel.getValue()
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "检测 AI 连接中…";

    // 1) 保存配置到本地 JSON → 2) 检测连接 → 3) 成功自动保存跳转 / 失败弹窗
    saveAiConfig(aiCfg)
      .then(function () {
        return testAiConnection(aiCfg);
      })
      .then(function () {
        // 连接成功：自动保存并跳转，无需点击
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        updateSummary(p);
        submitBtn.disabled = false;
        showToast("AI 连接正常，档案已保存 ✓");
        setTimeout(function () {
          window.location.href = "dashboard.html";
        }, 600);
      })
      .catch(function (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = readSaved() ? "更新档案" : "保存档案";
        showAiTest("AI 连接失败", String(err && err.message ? err.message : err), true);
      });
  });

  /* ---------- AI 配置本地 JSON 读写（不存浏览器） ---------- */

  function saveAiConfig(cfg) {
    return fetch("/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg)
    }).then(function (res) {
      if (!res.ok) throw new Error("本地配置保存失败（HTTP " + res.status + "）");
      return res.json();
    });
  }

  /* ---------- AI 连接检测结果弹窗 ---------- */

  var aiTestMask = document.getElementById("ai-test-mask");
  var aiTestTitle = document.getElementById("ai-test-title");
  var aiTestBox = document.getElementById("ai-test-box");
  var aiTestInterpret = document.getElementById("ai-test-interpret");

  // 将原始报错解读为可读信息
  function interpretAiError(msg) {
    msg = String(msg || "");
    if (/authentication_error|invalid.*api\s*key/i.test(msg) || /401/.test(msg)) {
      return "API Key 无效或已过期。请到对应平台控制台重新生成 Key，并检查填写的 Key 是否正确（注意不要有多余空格）。";
    }
    if (/404|not found/i.test(msg)) {
      return "接口地址不正确。请检查 API 地址是否填对（如 https://api.deepseek.com/v1），并确认该地址支持 /chat/completions 接口。";
    }
    if (/invalid.*model|model.*not.*exist/i.test(msg)) {
      return "模型名称不正确。请在下拉中选择正确的模型，或确认该账号可用此模型。";
    }
    if (/429|rate\s*limit|too\s*many/i.test(msg)) {
      return "请求过于频繁（触发限流）。请稍后重试。";
    }
    if (/failed\s*to\s*fetch|networkerror|network|ERR_NAME/i.test(msg)) {
      return "无法连接到该地址。请检查：① 网络是否正常；② API 地址是否填写正确；③ 该平台是否允许浏览器直接调用（部分平台需经后端中转）。";
    }
    if (/cors|access-control/i.test(msg)) {
      return "该平台不允许浏览器跨域调用（CORS）。可换用其他兼容 OpenAI 接口的平台，或后续接入后端服务。";
    }
    return "连接失败。请检查 API 地址、Key 和模型是否都填写正确。";
  }

  function showAiTest(title, text, isError, onClose) {
    aiTestTitle.textContent = title;
    aiTestBox.textContent = text;
    aiTestBox.className = "ai-test-box" + (isError ? " error" : "");
    if (isError) {
      aiTestInterpret.textContent = interpretAiError(text);
      aiTestInterpret.hidden = false;
    } else {
      aiTestInterpret.hidden = true;
    }
    aiTestMask.hidden = false;
    document.body.style.overflow = "hidden";
    closeAiTest._onClose = onClose || null;
  }

  function closeAiTest() {
    aiTestMask.hidden = true;
    document.body.style.overflow = "";
    if (closeAiTest._onClose) {
      var cb = closeAiTest._onClose;
      closeAiTest._onClose = null;
      cb();
    }
  }

  document.getElementById("ai-test-ok").addEventListener("click", closeAiTest);
  document.getElementById("ai-test-close").addEventListener("click", closeAiTest);
  aiTestMask.addEventListener("click", function (e) {
    if (e.target === aiTestMask) closeAiTest();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !aiTestMask.hidden) closeAiTest();
  });

  /* ---------- AI 大模型联通性检测 ---------- */

  function testAiConnection(cfg) {
    var url = cfg.base.replace(/\/+$/, "") + "/chat/completions";
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1
      })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            var msg = t.slice(0, 300);
            throw new Error("HTTP " + res.status + (msg ? "：" + msg : ""));
          });
        }
        return res.json();
      })
      .then(function (data) {
        // 响应里带 error（如模型不存在 / key 无效）→ 视为连接失败
        if (data && data.error) {
          var em = data.error.message || JSON.stringify(data.error);
          throw new Error(String(em).slice(0, 200));
        }
        // 必须包含有效回复内容
        if (!data || !data.choices || !data.choices.length) {
          throw new Error("响应格式异常（未返回内容）");
        }
        return data;
      });
  }

  /* ---------- 清除本地档案（确认弹窗：倒计时 + 输入验证） ---------- */

  var clearBtn = document.getElementById("btn-clear");
  var clearMask = document.getElementById("clear-mask");
  var clearConfirm = document.getElementById("clear-confirm");
  var clearCancel = document.getElementById("clear-cancel");
  var clearCancelX = document.getElementById("clear-cancel-x");
  var clearVerify = document.getElementById("clear-verify");
  var CLEAR_COUNTDOWN = 15;
  var clearTimer = null;
  var clearDone = false;

  function updateClearState() {
    var typed = clearVerify && clearVerify.value.trim() === "我确认清除";
    clearConfirm.disabled = !(clearDone && typed);
  }

  function openClearModal() {
    clearMask.hidden = false;
    document.body.style.overflow = "hidden";

    if (clearVerify) clearVerify.value = "";
    clearDone = false;
    updateClearState();

    var left = CLEAR_COUNTDOWN;
    clearConfirm.textContent = "确认清除（" + left + "s）";
    clearInterval(clearTimer);
    clearTimer = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(clearTimer);
        clearDone = true;
        clearConfirm.textContent = "确认清除";
        updateClearState();
      } else {
        clearConfirm.textContent = "确认清除（" + left + "s）";
      }
    }, 1000);
  }

  function closeClearModal() {
    clearInterval(clearTimer);
    clearMask.hidden = true;
    document.body.style.overflow = "";
  }

  function doClear() {
    localStorage.removeItem(STORAGE_KEY);
    // 同时清除 AI 大模型配置（本地 JSON）
    fetch("/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }).catch(function () {});
    form.reset();
    birthYear.setValue("");
    birthMonth.setValue("");
    renderDays();
    blood.setValue("未知");
    aiModel.setValue("");
    updateAgeHint();
    updateSummary(null);
    closeClearModal();
    showToast("本地档案已清除");
  }

  clearBtn.addEventListener("click", openClearModal);
  clearCancel.addEventListener("click", closeClearModal);
  clearCancelX.addEventListener("click", closeClearModal);
  clearMask.addEventListener("click", function (e) {
    if (e.target === clearMask) closeClearModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && clearMask && !clearMask.hidden) closeClearModal();
  });
  if (clearVerify) clearVerify.addEventListener("input", updateClearState);
  clearConfirm.addEventListener("click", function () {
    if (clearConfirm.disabled) return;
    doClear();
  });

  /* ---------- 初始化 ---------- */

  birthYear.setOptions(yearOptions());
  birthMonth.setOptions(monthOptions());
  renderDays();

  var saved = readSaved();
  fillForm(saved);
  updateSummary(saved);

  // 从本地 JSON 读取 AI 配置回填（不存浏览器）
  fetch("/api/ai-config")
    .then(function (res) {
      return res.json();
    })
    .then(function (cfg) {
      if (cfg && (cfg.base || cfg.model || cfg.key)) {
        form["ai-base"].value = cfg.base || "";
        aiModel.setValue(cfg.model || "");
        form["ai-key"].value = cfg.key || "";
      }
    })
    .catch(function () {
      /* 未通过本地服务器打开时忽略 */
    });
})();
