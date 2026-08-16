/* ==========================================================
   CaseRecord · PaddleOCR 引擎（ES Module，惰性加载）
   页面打开时不加载引擎；仅在真正需要识别时才加载
   （有已保存的识别结果时打开页面零卡顿）
   ========================================================== */

let ocrMod = null;
let initialized = false;
let loadError = null;
let loadPromise = null;

// 部分 CJS 模块（如 opencv）依赖隐式全局 Module，ESM 严格模式下需预先提供
window.Module = window.Module || {};

window.paddleOcrStatus = function () {
  if (loadError) return "error: " + loadError;
  if (ocrMod) return initialized ? "ready" : "loaded";
  return "loading";
};

// 首次调用识别时才加载引擎与模型
function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = import("../assets/ocr/paddle/ocr.bundle.mjs")
      .then(function (m) {
        ocrMod = m;
        return m
          .init(
            "assets/ocr/paddle/models/det/model.json",
            "assets/ocr/paddle/models/rec/model.json"
          )
          .then(function () {
            initialized = true;
          });
      })
      .catch(function (e) {
        loadError = (e && e.message) ? e.message : String(e);
        console.error("PaddleOCR 引擎加载失败:", e);
        throw e;
      });
  }
  return loadPromise;
}

// 供传统脚本（report-detail.js）调用的识别入口
window.runPaddleOCR = async function (dataUrl) {
  await ensureLoaded();
  if (loadError) throw new Error(loadError);

  const img = new Image();
  await new Promise(function (resolve, reject) {
    img.onload = resolve;
    img.onerror = function () {
      reject(new Error("图片加载失败"));
    };
    img.src = dataUrl;
  });

  const res = await ocrMod.recognize(img);
  const text = res && res.text;
  if (Array.isArray(text)) return text.join("\n");
  return String(text || "");
};
