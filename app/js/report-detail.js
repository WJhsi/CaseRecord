/* ==========================================================
   CaseRecord · 报告详情页
   根据 caseId + idx 定位并全屏展示某份检验/检查报告；
   流程：AI 识别文字（视觉模型看原图转文字）→ AI 解析（基于文字）
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

  var toastEl = document.getElementById("toast");
  function showToast(msg, type) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "toast " + (type || "ok") + " show";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2800);
  }

  /* ---------- 定位报告 ---------- */

  var caseId = null;
  var idx = -1;
  try {
    var qs = new URLSearchParams(window.location.search);
    caseId = qs.get("caseId");
    idx = parseInt(qs.get("idx"), 10);
  } catch (e) {
    /* ignore */
  }

  var list = readCases();
  var c = null;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(caseId)) {
      c = list[i];
      break;
    }
  }

  var img = c && c.images && !isNaN(idx) ? c.images[idx] : null;
  if (!c || !img) {
    window.location.replace("dashboard.html");
    return;
  }

  // 检查报告（影像类：CT / MR / DR / 超声等）：让 AI 分「影像表现 / 影像判断」输出
  var isCheckReport = img.kind === "检查报告";

  /* ---------- 渲染 ---------- */

  $("back-link").href = "case-detail.html?id=" + c.id;

  var d = new Date(c.createdAt);
  $("report-meta").textContent = "记录于 " + d.toLocaleString("zh-CN");

  var content = $("report-content");

  if (img.type && img.type.indexOf("image/") === 0) {
    var im = document.createElement("img");
    im.className = "report-img";
    im.src = img.dataUrl;
    im.alt = img.name || "报告";
    content.appendChild(im);
  } else {
    // PDF：内嵌预览 + 打开链接
    var iframe = document.createElement("iframe");
    iframe.className = "report-pdf-frame";
    iframe.src = img.dataUrl;
    iframe.title = img.name || "PDF 报告";
    content.appendChild(iframe);

    var link = document.createElement("a");
    link.className = "report-open";
    link.href = img.dataUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "在新标签页打开 / 下载";
    content.appendChild(link);
  }

  /* ==========================================================
     AI 识别文字（视觉模型看原图）→ AI 解析（基于文字）
     ========================================================== */

  var btnOcr = document.getElementById("btn-ai-ocr");
  var btnParse = document.getElementById("btn-ai-parse");
  var ocrText = document.getElementById("ai-ocr-text");
  var parseResult = document.getElementById("ai-parse-result");
  var aiMeta = document.getElementById("ai-meta");
  var aiHint = document.getElementById("ai-hint");
  var aiTimer = document.getElementById("ai-timer");

  var aiTimerId = null;
  var aiStartMs = 0;
  var aiBusy = false;

  function startAiTimer() {
    aiStartMs = Date.now();
    aiTimer.hidden = false;
    aiTimer.textContent = "已用时 0 秒";
    clearInterval(aiTimerId);
    aiTimerId = setInterval(function () {
      var sec = Math.round((Date.now() - aiStartMs) / 1000);
      aiTimer.textContent = "已用时 " + sec + " 秒";
    }, 200);
  }

  function stopAiTimer() {
    clearInterval(aiTimerId);
    aiTimerId = null;
    return Math.round((Date.now() - aiStartMs) / 1000);
  }

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
    if (/image|vision|multimodal|visual|content.*type|unsupported.*(type|media)/i.test(msg)) {
      return "当前模型不支持图片输入。「AI 识别文字」需要支持视觉的模型（如 GPT-4o、Gemini 3、通义千问 VL、GLM-4V），请到「编辑档案」页更换模型。";
    }
    return "调用失败。请检查 API 地址、Key 和模型是否都填写正确。";
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

  function setMeta(elapsed, usage) {
    var parts = [];
    if (elapsed != null) parts.push("本次耗时 " + elapsed + " 秒");
    if (usage && usage.total_tokens != null) {
      parts.push("Token 用量：" + usage.total_tokens + (usage.prompt_tokens != null ? "（输入 " + usage.prompt_tokens + " / 输出 " + usage.completion_tokens + "）" : ""));
    }
    parts.push("时间：" + new Date().toLocaleString("zh-CN"));
    aiMeta.textContent = parts.join(" · ");
    aiTimer.textContent = "";
    aiTimer.hidden = true;
  }

  function finishButton(btn) {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || btn.textContent;
    aiBusy = false;
  }

  function lockButton(btn) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    aiBusy = true;
    startAiTimer();
  }

  // 多模态请求：文本 + 报告原图（OpenAI 兼容 image_url 格式）
  function callAiVision(cfg, dataUrl, promptText) {
    var url = cfg.base.replace(/\/+$/, "") + "/chat/completions";
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
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ]
      })
    })
      .then(parseResponse)
      .then(function (data) {
        btnOcr._lastUsage = data.usage || null;
        var contentText = data.choices[0].message && data.choices[0].message.content;
        if (!contentText) throw new Error("AI 未返回内容");
        return { text: String(contentText).trim(), usage: data.usage || null };
      });
  }

  // 纯文字请求：解析（任何文本模型都可用）
  function callAiText(cfg, promptText) {
    var url = cfg.base.replace(/\/+$/, "") + "/chat/completions";
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
          { role: "user", content: promptText }
        ]
      })
    })
      .then(parseResponse)
      .then(function (data) {
        btnParse._lastUsage = data.usage || null;
        var contentText = data.choices[0].message && data.choices[0].message.content;
        if (!contentText) throw new Error("AI 未返回内容");
        return { text: String(contentText).trim(), usage: data.usage || null };
      });
  }

  function parseResponse(res) {
    if (!res.ok) {
      return res.text().then(function (t) {
        var msg = t.slice(0, 300);
        throw new Error("HTTP " + res.status + (msg ? "：" + msg : ""));
      });
    }
    return res.json().then(function (data) {
      if (data && data.error) {
        var em = data.error.message || JSON.stringify(data.error);
        throw new Error(String(em).slice(0, 200));
      }
      if (!data || !data.choices || !data.choices.length) {
        throw new Error("响应格式异常（未返回内容）");
      }
      return data;
    });
  }

  function readAiConfig() {
    return fetch("/api/ai-config").then(function (res) {
      if (!res.ok) throw new Error("无法读取 AI 配置（HTTP " + res.status + "）");
      return res.json();
    }).then(function (cfg) {
      if (!cfg || !cfg.base || !cfg.key || !cfg.model) {
        throw new Error("尚未配置 AI 大模型，请先到「编辑档案」页填写 API 地址、Key 和模型。");
      }
      return cfg;
    });
  }

  /* ---------- 第一步：AI 识别文字（看原图转文字） ---------- */

  var OCR_PROMPT =
    "请仔细查看这张报告原图，把图中所有文字内容完整、准确地转写出来。要求：\n" +
    "1. 只转写，不做任何解读、不添加评论；\n" +
    "2. 保持报告原有结构与顺序，分行列出；\n" +
    "3. 不要使用 Markdown 符号（不要用 # * - 等）；\n" +
    "4. 看不清楚的内容用「？？」标记，不要编造。";

  btnOcr.addEventListener("click", function () {
    if (aiBusy) return;
    if (img.type && img.type.indexOf("image/") !== 0) {
      showAiModal("AI 识别文字失败", "PDF 报告无法直接发送给 AI 查看，请先在左栏打开 PDF 查看内容，或将 PDF 转为图片后重新上传。", true);
      return;
    }
    lockButton(btnOcr);
    btnOcr.textContent = "AI 识别中…";

    readAiConfig()
      .then(function (cfg) {
        return callAiVision(cfg, img.dataUrl, OCR_PROMPT);
      })
      .then(function (result) {
        var elapsed = stopAiTimer();
        ocrText.value = result.text;
        aiHint.textContent = "识别完成，未保存";
        setMeta(elapsed, result.usage);
        showToast("AI 识别文字完成 ✓");
      })
      .catch(function (err) {
        stopAiTimer();
        showAiModal("AI 识别文字失败", String(err && err.message ? err.message : err), true);
      })
      .finally(function () {
        finishButton(btnOcr);
      });
  });

  /* ---------- 第二步：AI 解析（基于识别文字） ---------- */

  function buildParsePrompt() {
    var text = ocrText.value.trim();
    if (isCheckReport) {
      return (
        "你是一位专业的医学影像科医生。以下是检查报告的识别文字（可能不准确，仅供参考）：\n" +
        text +
        "\n\n请解析，要求：\n" +
        "1. 先分「影像表现」和「影像判断」两段，照实转写报告中的描述与结论；\n" +
        "2. 再简要解读：指出异常或需要关注的地方，给出就医或复查建议；\n" +
        "3. 不要使用 Markdown 符号（不要用 # * - 等）；\n" +
        "4. 只依据识别文字内容，不要虚构；\n" +
        "5. 控制在 300～500 字。"
      );
    }
    return (
      "你是一位专业的检验科医生。以下是检验报告的识别文字（可能不准确，仅供参考）：\n" +
      text +
      "\n\n请解析，要求：\n" +
      "1. 照实转写各项检验项目、结果、单位、参考范围，并判断每项是否正常（偏高/偏低/正常）；\n" +
      "2. 简要解读异常项目可能提示的情况，给出就医或复查建议；\n" +
      "3. 不要使用 Markdown 符号（不要用 # * - 等）；\n" +
      "4. 只依据识别文字内容，不要虚构；\n" +
      "5. 控制在 300～500 字。"
    );
  }

  btnParse.addEventListener("click", function () {
    if (aiBusy) return;
    if (!ocrText.value.trim()) {
      showToast("请先点击「AI 识别文字」获取报告文字。", "err");
      return;
    }
    lockButton(btnParse);
    btnParse.textContent = "AI 解析中…";

    readAiConfig()
      .then(function (cfg) {
        return callAiText(cfg, buildParsePrompt());
      })
      .then(function (result) {
        var elapsed = stopAiTimer();
        parseResult.value = result.text;
        aiHint.textContent = "本次解析，未保存";
        setMeta(elapsed, result.usage);
        showToast("AI 解析完成 ✓");
      })
      .catch(function (err) {
        stopAiTimer();
        showAiModal("AI 解析失败", String(err && err.message ? err.message : err), true);
      })
      .finally(function () {
        finishButton(btnParse);
      });
  });
})();
