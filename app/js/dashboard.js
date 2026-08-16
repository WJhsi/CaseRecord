/* ==========================================================
   CaseRecord · 个人界面
   渲染已保存的个人档案；无档案时回到首页
   ========================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "caseRecord.profile";

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  // 病例保存成功提示
  var toast = document.getElementById("toast");

  function showToast(msg, type) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast " + (type || "ok") + " show";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove("show");
    }, 2800);
  }

  var p = readSaved();
  if (!p || !p.name) {
    window.location.replace("index.html");
    return;
  }

  // 头像：姓名首字
  $("avatar").textContent = p.name.charAt(0);
  $("p-name").textContent = p.name;

  // 标签：性别 · 年龄 · 血型
  var chips = [];
  if (p.gender) chips.push(p.gender);
  if (p.age != null) chips.push(p.age + " 岁");
  if (p.blood && p.blood !== "未知") chips.push(p.blood + " 型");
  $("p-chips").innerHTML = chips
    .map(function (c) {
      return '<span class="chip">' + c + "</span>";
    })
    .join("");

  // 体征信息
  $("p-gender").textContent = p.gender || "—";
  $("p-birth").textContent = p.birth || "—";
  $("p-blood").textContent = p.blood && p.blood !== "未知" ? p.blood + " 型" : "—";
  $("p-height").textContent = p.height ? p.height + " cm" : "—";
  $("p-weight").textContent = p.weight ? p.weight + " kg" : "—";

  // 病史信息
  $("p-history").textContent = p.history || "—";
  $("p-allergy").textContent = p.allergy || "—";
  $("p-notes").textContent = p.notes || "—";

  // 保存时间
  if (p.savedAt) {
    var d = new Date(p.savedAt);
    $("saved-at").textContent = "档案保存于 " + d.toLocaleString("zh-CN");
  }

  var STORAGE_KEY = "caseRecord.profile";
  var CASES_KEY = "caseRecord.cases";

  function readCases() {
    try {
      var arr = JSON.parse(localStorage.getItem(CASES_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 病例列表 ---------- */

  function renderCases() {
    var list = readCases();
    var section = $("cases-section");
    if (!section) return;
    if (!list.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    $("cases-count").textContent = "共 " + list.length + " 条";

    var html = list
      .slice()
      .reverse()
      .map(function (c) {
        var d = new Date(c.createdAt);
        var dateStr =
          d.toLocaleDateString("zh-CN") +
          " " +
          d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        var tags = [];
        if (c.images && c.images.length) tags.push(c.images.length + " 份报告");
        if (c.meds && c.meds.length) tags.push(c.meds.length + " 种药物");
        var tagsHtml = tags
          .map(function (t) {
            return '<span class="chip">' + t + "</span>";
          })
          .join("");
        return (
          '<a class="case-item" href="case-detail.html?id=' + c.id + '">' +
          '<div class="case-left">' +
          '<div class="case-date">' + dateStr + "</div>" +
          '<div class="case-cond">' + escapeHtml(c.condition) + "</div>" +
          "</div>" +
          '<div class="case-tags">' + tagsHtml + "</div>" +
          "</a>"
        );
      })
      .join("");
    $("cases-list").innerHTML = html;
  }

  // 从添加病例页保存后跳转回来时提示
  if (/[?&]saved=1/.test(window.location.search)) {
    showToast("病例已保存 ✓");
  }

  // 删除病例后跳转回来时提示
  if (/[?&]deleted=1/.test(window.location.search)) {
    showToast("病例已删除");
  }

  renderCases();

  /* ==========================================================
     病例说明：手动编辑保存 + AI 自动生成
     ========================================================== */

  var NOTE_KEY = "caseRecord.caseNote";

  var noteInput = document.getElementById("case-note-input");
  var noteHint = document.getElementById("case-note-hint");
  var noteMeta = document.getElementById("case-note-meta");
  var noteAiBtn = document.getElementById("btn-ai-note");

  // 回填已保存的说明（只读展示，不可手动修改）
  function readNoteMeta() {
    try {
      var meta = JSON.parse(localStorage.getItem(NOTE_KEY + ".meta"));
      return meta && typeof meta === "object" ? meta : null;
    } catch (e) {
      return null;
    }
  }

  try {
    var savedNote = localStorage.getItem(NOTE_KEY);
    if (savedNote) {
      noteInput.value = savedNote;
      var meta = readNoteMeta();
      if (meta) {
        var parts = [];
        if (meta.totalTokens != null) {
          parts.push("Token 用量：" + meta.totalTokens + (meta.promptTokens != null ? "（输入 " + meta.promptTokens + " / 输出 " + meta.completionTokens + "）" : ""));
        }
        if (meta.time) parts.push("生成时间：" + meta.time);
        if (parts.length) noteMeta.textContent = parts.join(" · ");
      }
      noteHint.textContent = meta && meta.time ? "上次生成 " + meta.time : "已生成";
    }
  } catch (e) {
    /* ignore */
  }

  /* ---------- AI 生成说明 ---------- */

  // 弹窗（与档案页同款：灰遮罩 + 红框完整报错 + 橙框解读）
  var aiMask = document.getElementById("ai-test-mask");
  var aiTitle = document.getElementById("ai-test-title");
  var aiBox = document.getElementById("ai-test-box");
  var aiInterpret = document.getElementById("ai-test-interpret");

  function interpretAiError(msg) {
    msg = String(msg || "");
    if (/authentication_error|invalid.*api\s*key/i.test(msg) || /401/.test(msg)) {
      return "API Key 无效或已过期。请到「编辑档案」页检查 Key 是否正确（注意不要有多余空格）。";
    }
    if (/404|not found/i.test(msg)) {
      return "接口地址不正确。请到「编辑档案」页检查 API 地址是否填对（如 https://api.deepseek.com/v1）。";
    }
    if (/invalid.*model|model.*not.*exist/i.test(msg)) {
      return "模型名称不正确。请到「编辑档案」页在下拉中选择正确的模型。";
    }
    if (/429|rate\s*limit|too\s*many/i.test(msg)) {
      return "请求过于频繁（触发限流）。请稍后重试。";
    }
    if (/failed\s*to\s*fetch|networkerror|network|ERR_NAME/i.test(msg)) {
      return "无法连接到该地址。请检查：① 网络是否正常；② API 地址是否填写正确；③ 该平台是否允许浏览器直接调用。";
    }
    if (/cors|access-control/i.test(msg)) {
      return "该平台不允许浏览器跨域调用（CORS）。可换用其他兼容 OpenAI 接口的平台。";
    }
    return "生成失败。请检查 API 地址、Key 和模型是否都填写正确。";
  }

  function showAiModal(title, text, isError) {
    aiTitle.textContent = title;
    aiBox.textContent = text;
    aiBox.className = "ai-test-box" + (isError ? " error" : "");
    if (isError) {
      aiInterpret.textContent = interpretAiError(text);
      aiInterpret.hidden = false;
    } else {
      aiInterpret.hidden = true;
    }
    aiMask.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeAiModal() {
    aiMask.hidden = true;
    document.body.style.overflow = "";
  }

  document.getElementById("ai-test-ok").addEventListener("click", closeAiModal);
  document.getElementById("ai-test-close").addEventListener("click", closeAiModal);
  aiMask.addEventListener("click", function (e) {
    if (e.target === aiMask) closeAiModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !aiMask.hidden) closeAiModal();
  });

  // 将病例整理成 AI 可读的摘要
  function buildCaseSummary() {
    var cases = readCases();
    if (!cases.length) return null;
    return cases.map(function (c, i) {
      var d = new Date(c.createdAt);
      var line = {
        序号: i + 1,
        时间: d.toLocaleString("zh-CN"),
        病情: c.condition || "",
        报告: (c.images || []).map(function (img) {
          var ocr = (img.ocr && img.ocr.rows) || [];
          var ocrText = ocr
            .map(function (r) {
              return r.name + " " + (r.value || "") + (r.status ? "（" + r.status + "）" : "");
            })
            .join("；");
          return (img.kind || "报告") + (img.modality ? "（" + img.modality + "）" : "") + (ocrText ? "：" + ocrText : "");
        }),
        药物: (c.meds || []).map(function (m) {
          return m.name + (m.usage ? "（" + m.usage + "）" : "");
        }),
        治疗方案: (c.treatment || "") + (c.treatmentNote ? "：" + c.treatmentNote : "")
      };
      return line;
    });
  }

  noteAiBtn.addEventListener("click", function () {
    var summary = buildCaseSummary();
    if (!summary) {
      showToast("暂无可说明的病例", "err");
      return;
    }

    // 读取 AI 配置（本地 JSON）
    fetch("/api/ai-config")
      .then(function (res) {
        if (!res.ok) throw new Error("无法读取 AI 配置（HTTP " + res.status + "）");
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg || !cfg.base || !cfg.key || !cfg.model) {
          throw new Error("尚未配置 AI 大模型，请先到「编辑档案」页填写 API 地址、Key 和模型。");
        }
        return callAi(cfg, summary);
      })
      .then(function (text) {
        noteInput.value = text;
        var now = new Date().toLocaleString("zh-CN");
        var usage = noteAiBtn._lastUsage || null;
        var meta = { time: now };
        if (usage) {
          meta.totalTokens = usage.total_tokens != null ? usage.total_tokens : null;
          meta.promptTokens = usage.prompt_tokens != null ? usage.prompt_tokens : null;
          meta.completionTokens = usage.completion_tokens != null ? usage.completion_tokens : null;
        }
        try {
          localStorage.setItem(NOTE_KEY, text);
          localStorage.setItem(NOTE_KEY + ".meta", JSON.stringify(meta));
        } catch (e) {
          /* ignore */
        }
        var parts = [];
        if (meta.totalTokens != null) {
          parts.push("Token 用量：" + meta.totalTokens + (meta.promptTokens != null ? "（输入 " + meta.promptTokens + " / 输出 " + meta.completionTokens + "）" : ""));
        }
        if (meta.time) parts.push("生成时间：" + meta.time);
        if (parts.length) noteMeta.textContent = parts.join(" · ");
        noteHint.textContent = "已自动保存 " + now;
        showToast("AI 说明已生成并自动保存 ✓");
      })
      .catch(function (err) {
        showAiModal("AI 生成说明失败", String(err && err.message ? err.message : err), true);
      })
      .finally(function () {
        noteAiBtn.disabled = false;
        noteAiBtn.textContent = "✦ AI 生成说明";
      });

    noteAiBtn.disabled = true;
    noteAiBtn.textContent = "AI 生成中…";
  });

  function callAi(cfg, summary) {
    var url = cfg.base.replace(/\/+$/, "") + "/chat/completions";
    var prompt =
      "你是一位专业的医疗助理。以下是患者的病例记录（JSON）：\n" +
      JSON.stringify(summary, null, 1) +
      "\n\n请为患者写一段「病例说明」，作为个人健康档案的总览。要求：\n" +
      "1. 用简洁、专业、通俗的中文概括整体病情、检查结果、用药和治疗情况；\n" +
      "2. 分条列举更清晰，但不要使用 Markdown 符号（不要用 # * - 等）；\n" +
      "3. 只依据上面给出的信息，不要虚构任何内容；\n" +
      "4. 控制在 200～400 字。";
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: "你是专业的医疗助理，输出中文。" },
          { role: "user", content: prompt }
        ]
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
        if (data && data.error) {
          var em = data.error.message || JSON.stringify(data.error);
          throw new Error(String(em).slice(0, 200));
        }
        if (!data || !data.choices || !data.choices.length) {
          throw new Error("响应格式异常（未返回内容）");
        }
        var content = data.choices[0].message && data.choices[0].message.content;
        if (!content) throw new Error("AI 未返回内容");
        noteAiBtn._lastUsage = data.usage || null;
        return String(content).trim();
      });
  }
})();
