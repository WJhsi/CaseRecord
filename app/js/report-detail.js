/* ==========================================================
   CaseRecord · 报告详情页
   根据 caseId + idx 定位并全屏展示某份检验/检查报告；
   进入页面自动识别（视觉模型看原图转文字）→ 点「AI 解析」用文本模型解析
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
     进入页面自动识别（视觉模型看原图转文字）→ AI 解析（文本模型）
     ========================================================== */

  var btnParse = document.getElementById("btn-ai-parse");
  var parseResult = document.getElementById("ai-parse-result");
  var recogStatus = document.getElementById("ai-recog-status");
  var aiMeta = document.getElementById("ai-meta");
  var aiHint = document.getElementById("ai-hint");
  var aiTimer = document.getElementById("ai-timer");
  var aiParseTimer = document.getElementById("ai-parse-timer");

  // 识别出的报告文字（内存中，供解析使用）
  var recognizedText = "";
  var recognitionDone = false; // true=识别成功 / false=未成功

  var aiTimerId = null;
  var aiStartMs = 0;
  var aiBusy = false;
  var activeTimer = null; // 当前计时显示元素

  function startAiTimer(timerEl) {
    activeTimer = timerEl || aiTimer;
    aiStartMs = Date.now();
    activeTimer.hidden = false;
    activeTimer.textContent = "已用时 0 秒";
    clearInterval(aiTimerId);
    aiTimerId = setInterval(function () {
      var sec = Math.round((Date.now() - aiStartMs) / 1000);
      activeTimer.textContent = "已用时 " + sec + " 秒";
    }, 200);
  }

  function stopAiTimer() {
    clearInterval(aiTimerId);
    aiTimerId = null;
    if (activeTimer) {
      activeTimer.textContent = "";
      activeTimer.hidden = true;
      activeTimer = null;
    }
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
      return "接口地址不正确。请到「编辑档案」页检查 API 地址是否填对（如 https://dashscope.aliyuncs.com/compatible-mode/v1）。";
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
      return "当前模型不支持图片输入。「AI 识别文字」需要支持视觉的模型（如通义千问 VL、GPT-4o、GLM-4V），请到「编辑档案」页的「识别模型」里更换为视觉模型。";
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

  function showRecogStatus(msg, isError) {
    if (!recogStatus) return;
    recogStatus.textContent = msg;
    recogStatus.className = "ai-recog-status" + (isError ? " err" : " ok");
    recogStatus.hidden = false;
  }

  function setMeta(elapsed, usage) {
    var parts = [];
    if (elapsed != null) parts.push("本次耗时 " + elapsed + " 秒");
    if (usage && usage.total_tokens != null) {
      parts.push("Token 用量：" + usage.total_tokens + (usage.prompt_tokens != null ? "（输入 " + usage.prompt_tokens + " / 输出 " + usage.completion_tokens + "）" : ""));
    }
    parts.push("时间：" + new Date().toLocaleString("zh-CN"));
    aiMeta.textContent = parts.join(" · ");
  }

  function lockButton(btn, label, timerEl) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    aiBusy = true;
    startAiTimer(timerEl);
  }

  function finishButton(btn) {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || btn.textContent;
    aiBusy = false;
  }

  // 读取 AI 配置（兼容新结构 {vision, parse} 与旧结构 {base, key, model}）
  function readAiConfig() {
    return fetch("/api/ai-config")
      .then(function (res) {
        if (!res.ok) throw new Error("无法读取 AI 配置（HTTP " + res.status + "）");
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg) throw new Error("尚未配置 AI 大模型，请先到「编辑档案」页填写。");
        var vision = cfg.vision || (cfg.base ? { base: cfg.base, key: cfg.key, model: cfg.model } : null);
        var parse = cfg.parse || (cfg.base ? { base: cfg.base, key: cfg.key, model: cfg.model } : null);
        return { vision: vision, parse: parse };
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
        var contentText = data.choices[0].message && data.choices[0].message.content;
        if (!contentText) throw new Error("AI 未返回内容");
        return { text: String(contentText).trim(), usage: data.usage || null };
      });
  }

  // 纯文字请求：解析（文本模型）
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
        var contentText = data.choices[0].message && data.choices[0].message.content;
        if (!contentText) throw new Error("AI 未返回内容");
        return { text: String(contentText).trim(), usage: data.usage || null };
      });
  }

  /* ---------- 自动识别：进入页面即调用视觉模型 ---------- */

  var OCR_PROMPT =
    "请仔细查看这张报告原图，把图中所有文字内容完整、准确地转写出来。要求：\n" +
    "1. 只转写，不做任何解读、不添加评论；\n" +
    "2. 保持报告原有结构与顺序，分行列出；\n" +
    "3. 不要使用 Markdown 符号（不要用 # * - 等）；\n" +
    "4. 看不清楚的内容用「？？」标记，不要编造。";

  var recognitionBusy = false;

  function autoRecognize() {
    if (recognitionBusy) return;
    // PDF 无法作为图片发送
    if (img.type && img.type.indexOf("image/") !== 0) {
      showRecogStatus("PDF 报告无法自动识别，请先在左栏查看内容，或转为图片后重新上传。", true);
      parseResult.placeholder = "PDF 报告无法自动识别文字…";
      return;
    }
    recognitionBusy = true;
    showRecogStatus("正在调用视觉模型识别报告文字…");
    parseResult.placeholder = "正在识别报告文字，请稍候…";

    readAiConfig()
      .then(function (cfg) {
        var vision = cfg.vision;
        if (!vision || !vision.base || !vision.key || !vision.model) {
          throw new Error("尚未配置「识别模型（视觉）」，请先到「编辑档案」页填写视觉模型的 API 地址、Key 和模型。");
        }
        return callAiVision(vision, img.dataUrl, OCR_PROMPT);
      })
      .then(function (result) {
        recognitionBusy = false;
        recognizedText = result.text;
        recognitionDone = true;
        var n = recognizedText.length;
        var parts = ["识别完成：共 " + n + " 字"];
        if (result.usage && result.usage.total_tokens != null) {
          parts.push("识别 Token " + result.usage.total_tokens);
        }
        showRecogStatus(parts.join("，"));
        parseResult.placeholder = "识别完成，点击「AI 解析」生成解析…";
        aiHint.textContent = "识别完成，未保存";
        // 检验报告：识别完成后自动提取检验项目表格
        if (!isCheckReport) {
          extractLabTable();
        }
      })
      .catch(function (err) {
        recognitionBusy = false;
        recognitionDone = false;
        showRecogStatus("识别失败：" + String(err && err.message ? err.message : err), true);
        parseResult.placeholder = "识别失败，可检查识别模型配置后刷新重试…";
      });
  }

  /* ---------- 检验报告：从识别文字提取检验项目表格 ---------- */

  var labBlock = document.getElementById("lab-table-block");
  var labTbody = document.getElementById("lab-tbody");
  var addRowBtn = document.getElementById("btn-add-row");
  var labRows = []; // [{name, value, unit, range}]

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderLabTable(rows) {
    labRows = rows;
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      html +=
        "<tr>" +
        '<td><input type="text" class="lab-input lab-name" data-i="' + i + '" value="' + esc(r.name || "") + '" placeholder="项目"></td>' +
        '<td><input type="text" class="lab-input lab-value" data-i="' + i + '" value="' + esc(r.value || "") + '" placeholder="结果"></td>' +
        '<td><input type="text" class="lab-input lab-unit" data-i="' + i + '" value="' + esc(r.unit || "") + '" placeholder="单位"></td>' +
        '<td><input type="text" class="lab-input lab-range" data-i="' + i + '" value="' + esc(r.range || "") + '" placeholder="参考范围"></td>' +
        "</tr>";
    }
    labTbody.innerHTML = html;
    var countEl = document.getElementById("lab-count");
    if (countEl) {
      var filled = 0;
      for (var j = 0; j < rows.length; j++) {
        if (rows[j] && (rows[j].name || rows[j].value)) filled++;
      }
      countEl.textContent = "共 " + filled + " 项";
    }
  }

  // 检验报告：进入页面即显示表格框架（表头 + 空行占位），识别完成后再填充
  function showLabTablePlaceholder() {
    var rows = [];
    for (var i = 0; i < 6; i++) {
      rows.push({ name: "", value: "", unit: "", range: "" });
    }
    renderLabTable(rows);
    labBlock.hidden = false;
  }

  // 读取表格当前值
  function collectLabRows() {
    var rows = [];
    var inputs = labTbody.querySelectorAll("tr");
    for (var i = 0; i < inputs.length; i++) {
      var tr = inputs[i];
      var name = (tr.querySelector(".lab-name") || {}).value || "";
      var value = (tr.querySelector(".lab-value") || {}).value || "";
      var unit = (tr.querySelector(".lab-unit") || {}).value || "";
      var range = (tr.querySelector(".lab-range") || {}).value || "";
      if (name || value || range) rows.push({ name: name.trim(), value: value.trim(), unit: unit.trim(), range: range.trim() });
    }
    return rows;
  }

  // 用文本模型把识别文字提取为检验项目 JSON
  var extracting = false;

  function extractLabTable() {
    if (extracting || aiBusy || !recognizedText.trim()) return;
    extracting = true;
    showRecogStatus("正在提取检验项目…");
    startAiTimer(aiTimer);

    readAiConfig()
      .then(function (cfg) {
        var parse = cfg.parse;
        if (!parse || !parse.base || !parse.key || !parse.model) {
          throw new Error("尚未配置「解析模型（文本）」，请先到「编辑档案」页填写文本模型的 API 地址、Key 和模型。");
        }
        var prompt =
          "以下是检验报告的识别文字（可能不准确，仅供参考）：\n" +
          recognizedText +
          "\n\n请从中提取所有检验项目，输出 JSON 数组，每个元素包含：name（项目名称）、value（结果数值）、unit（单位，没有则为空）、range（参考范围，没有则为空）。\n" +
          "要求：\n" +
          "1. 只输出 JSON 数组，不要任何解释、不要 Markdown 代码块标记；\n" +
          "2. 只提取明确的检验项目，不要把标题、日期等无关内容当作项目；\n" +
          "3. 看不清楚或缺失的字段用空字符串。";
        return callAiText(parse, prompt);
      })
      .then(function (result) {
        stopAiTimer();
        var rows = [];
        try {
          var t = result.text.replace(/```json|```/g, "").trim();
          var arr = JSON.parse(t);
          if (Array.isArray(arr)) {
            rows = arr
              .filter(function (it) {
                return it && (it.name || it.value);
              })
              .map(function (it) {
                return {
                  name: String(it.name || "").trim(),
                  value: String(it.value || "").trim(),
                  unit: String(it.unit || "").trim(),
                  range: String(it.range || "").trim()
                };
              });
          }
        } catch (e) {
          /* JSON 解析失败则保留空表 */
        }
        // 不足 6 行时用空行补齐，保持表格框架常驻可见
        while (rows.length < 6) rows.push({ name: "", value: "", unit: "", range: "" });
        renderLabTable(rows);
        labBlock.hidden = false;
        var filledCount = 0;
        for (var fi = 0; fi < rows.length; fi++) {
          if (rows[fi] && (rows[fi].name || rows[fi].value)) filledCount++;
        }
        showRecogStatus(filledCount ? "检验项目已提取：共 " + filledCount + " 项，可修改后点击「AI 解析」。" : "识别完成，但未能提取出检验项目，可手动添加后解析。");
        aiHint.textContent = "识别完成，未保存";
      })
      .catch(function (err) {
        stopAiTimer();
        showRecogStatus("检验项目提取失败：" + String(err && err.message ? err.message : err), true);
      })
      .finally(function () {
        extracting = false;
      });
  }

  // 添加一行空项目
  if (addRowBtn) {
    addRowBtn.addEventListener("click", function () {
      var rows = collectLabRows();
      rows.push({ name: "", value: "", unit: "", range: "" });
      renderLabTable(rows);
      labBlock.hidden = false;
    });
  }

  /* ---------- AI 解析（文本模型） ---------- */

  function buildParsePrompt() {
    if (isCheckReport) {
      return (
        "你是一位专业的医学影像科医生。以下是检查报告的识别文字（可能不准确，仅供参考）：\n" +
        recognizedText.trim() +
        "\n\n请解析，要求：\n" +
        "1. 先分「影像表现」和「影像判断」两段，照实转写报告中的描述与结论；\n" +
        "2. 再简要解读：指出异常或需要关注的地方，给出就医或复查建议；\n" +
        "3. 不要使用 Markdown 符号（不要用 # * - 等）；\n" +
        "4. 只依据识别文字内容，不要虚构；\n" +
        "5. 控制在 300～500 字。"
      );
    }
    // 检验报告：用表格（含用户修改）作为解析依据
    var tableText = collectLabRows()
      .map(function (r) {
        return (r.name || "?") + "：" + (r.value || "?") + (r.unit ? " " + r.unit : "") + (r.range ? "（参考 " + r.range + "）" : "");
      })
      .join("\n");
    return (
      "你是一位专业的检验科医生。以下是检验报告的项目（识别提取，可能不准确，仅供参考）：\n" +
      tableText +
      "\n\n请解析，要求：\n" +
      "1. 逐项判断是否正常（偏高/偏低/正常），结合参考范围；\n" +
      "2. 简要解读异常项目可能提示的情况，给出就医或复查建议；\n" +
      "3. 不要使用 Markdown 符号（不要用 # * - 等）；\n" +
      "4. 只依据上面给出的信息，不要虚构；\n" +
      "5. 控制在 300～500 字。"
    );
  }

  btnParse.addEventListener("click", function () {
    if (aiBusy) return;
    if (!recognizedText.trim()) {
      showToast("自动识别未完成或失败，请稍候或检查识别模型配置后刷新重试。", "err");
      return;
    }
    lockButton(btnParse, "AI 解析中…", aiParseTimer);

    readAiConfig()
      .then(function (cfg) {
        var parse = cfg.parse;
        if (!parse || !parse.base || !parse.key || !parse.model) {
          throw new Error("尚未配置「解析模型（文本）」，请先到「编辑档案」页填写文本模型的 API 地址、Key 和模型。");
        }
        return callAiText(parse, buildParsePrompt());
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

  /* ---------- 初始化 ---------- */
  // 检验报告：进入页面立即显示表格框架（表头 + 空行占位），识别完成后填充
  if (!isCheckReport) {
    showLabTablePlaceholder();
  }
  autoRecognize();
})();
