/* ==========================================================
   CaseRecord · 个人界面
   档案与病例数据均存本地 JSON 文件（server.py API）
   ========================================================== */
(function () {
  "use strict";

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

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 加载档案 ---------- */

  function renderProfile(p) {
    if (!p || !p.name) {
      window.location.replace("index.html");
      return false;
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
    return true;
  }

  /* ---------- 病例列表 ---------- */

  function renderCases(list) {
    var section = $("cases-section");
    if (!section) return;
    if (!list || !list.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    $("cases-count").textContent = "共 " + list.length + " 条";

    var html = list
      .map(function (c) {
        var d = new Date(c.createdAt);
        var dateStr =
          d.toLocaleDateString("zh-CN") +
          " " +
          d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        var tags = [];
        if (c.imagesCount) tags.push(c.imagesCount + " 份报告");
        if (c.medsCount) tags.push(c.medsCount + " 种药物");
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

  function init() {
    // 从添加病例页保存后跳转回来时提示
    if (/[?&]saved=1/.test(window.location.search)) {
      showToast("病例已保存 ✓");
    }
    // 删除病例后跳转回来时提示
    if (/[?&]deleted=1/.test(window.location.search)) {
      showToast("病例已删除");
    }

    Store.migrateOnce()
      .then(function () {
        return Store.getProfile();
      })
      .then(function (p) {
        if (!renderProfile(p)) return Promise.reject("no profile");
        return Store.listCases();
      })
      .then(function (list) {
        renderCases(list);
      })
      .catch(function (e) {
        if (e === "no profile") return; // 已跳转首页
        /* 未通过本地服务器打开时忽略 */
      });
  }

  init();

  /* ==========================================================
     病例说明：AI 自动生成（仅本次展示，不保存）
     ========================================================== */

  var noteInput = document.getElementById("case-note-input");
  var noteHint = document.getElementById("case-note-hint");
  var noteMeta = document.getElementById("case-note-meta");
  var noteAiBtn = document.getElementById("btn-ai-note");
  var noteTimer = document.getElementById("note-timer");
  var noteModel = document.getElementById("case-note-model");

  // 显示病例说明调用的模型（解析模型）
  function showNoteModel(parseCfg) {
    if (!noteModel) return;
    if (parseCfg && parseCfg.model) {
      noteModel.textContent = "调用模型：" + parseCfg.model + (parseCfg.base ? "（" + parseCfg.base + "）" : "");
    } else {
      noteModel.textContent = "调用模型：未配置解析模型";
    }
  }

  // 页面加载时读取配置并显示调用模型
  fetch("/api/ai-config")
    .then(function (res) {
      return res.json();
    })
    .then(function (cfg) {
      if (!cfg) return;
      var parse = cfg.parse || (cfg.base ? { base: cfg.base, key: cfg.key, model: cfg.model } : null);
      showNoteModel(parse);
    })
    .catch(function () {
      /* 未通过本地服务器打开时忽略 */
    });

  // 生成过程实时计时
  var noteTimerId = null;
  var noteStartMs = 0;

  function startNoteTimer() {
    noteStartMs = Date.now();
    noteTimer.hidden = false;
    noteTimer.textContent = "已用时 0 秒";
    clearInterval(noteTimerId);
    noteTimerId = setInterval(function () {
      var sec = Math.round((Date.now() - noteStartMs) / 1000);
      noteTimer.textContent = "已用时 " + sec + " 秒";
    }, 200);
  }

  function stopNoteTimer() {
    clearInterval(noteTimerId);
    noteTimerId = null;
    return Math.round((Date.now() - noteStartMs) / 1000);
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

  // 读取全部病例（含 OCR 结果）整理成 AI 可读摘要
  function loadAllCases() {
    return Store.listCases().then(function (list) {
      var ids = list.map(function (c) {
        return c.id;
      });
      return Promise.all(
        ids.map(function (id) {
          return Store.getCase(id).then(function (c) {
            // 附加每张报告的 OCR 识别结果
            if (c && c.images && c.images.length) {
              return Promise.all(
                c.images.map(function (im, idx) {
                  return Store.getOcr(c.id, idx).then(function (ocr) {
                    im.ocr = ocr || (im.ocr || null);
                    return im;
                  });
                })
              ).then(function () {
                return c;
              });
            }
            return c;
          });
        })
      );
    });
  }

  function buildCaseSummary(cases) {
    if (!cases || !cases.length) return null;
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
    loadAllCases()
      .then(function (cases) {
        var summary = buildCaseSummary(cases);
        if (!summary) {
          showToast("暂无可说明的病例", "err");
          return null;
        }
        // 读取 AI 配置（本地 JSON；病例说明用「解析模型（文本）」）
        return fetch("/api/ai-config")
          .then(function (res) {
            if (!res.ok) throw new Error("无法读取 AI 配置（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (cfg) {
            if (!cfg) throw new Error("尚未配置 AI 大模型，请先到「编辑档案」页填写。");
            var parse = cfg.parse || (cfg.base ? { base: cfg.base, key: cfg.key, model: cfg.model } : null);
            if (!parse || !parse.base || !parse.key || !parse.model) {
              throw new Error("尚未配置「解析模型（文本）」，请先到「编辑档案」页填写 API 地址、Key 和模型。");
            }
            showNoteModel(parse);
            return callAi(parse, summary);
          });
      })
      .then(function (text) {
        if (!text) return;
        var elapsed = stopNoteTimer();
        noteInput.value = text;
        var now = new Date().toLocaleString("zh-CN");
        var usage = noteAiBtn._lastUsage || null;
        var parts = [];
        if (elapsed != null) parts.push("本次生成耗时 " + elapsed + " 秒");
        if (usage && usage.total_tokens != null) {
          parts.push("Token 用量：" + usage.total_tokens + (usage.prompt_tokens != null ? "（输入 " + usage.prompt_tokens + " / 输出 " + usage.completion_tokens + "）" : ""));
        }
        parts.push("生成时间：" + now);
        noteMeta.textContent = parts.join(" · ");
        noteTimer.textContent = "";
        noteTimer.hidden = true;
        noteHint.textContent = "本次生成，未保存";
        showToast("AI 说明已生成 ✓");
      })
      .catch(function (err) {
        stopNoteTimer();
        noteTimer.textContent = "";
        noteTimer.hidden = true;
        showAiModal("AI 生成说明失败", String(err && err.message ? err.message : err), true);
      })
      .finally(function () {
        noteAiBtn.disabled = false;
        noteAiBtn.textContent = "✦ AI 生成说明";
      });

    noteAiBtn.disabled = true;
    noteAiBtn.textContent = "AI 生成中…";
    startNoteTimer();
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
