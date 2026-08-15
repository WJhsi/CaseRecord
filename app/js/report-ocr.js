/* ==========================================================
   CaseRecord · PaddleOCR 引擎（ES Module）
   使用 @paddle-js-models/ocr（PP-OCRv3 前端版）
   模型默认从百度公开 CDN 加载，无需 API Key
   动态加载，加载失败时提供错误信息
   ========================================================== */

let ocrMod = null;
let initialized = false;
let loadError = null;

// 部分 CJS 模块（如 opencv）依赖隐式全局 Module，ESM 严格模式下需预先提供
window.Module = window.Module || {};

window.paddleOcrStatus = function () {
  if (loadError) return "error: " + loadError;
  if (ocrMod) return initialized ? "ready" : "loaded";
  return "loading";
};

// 动态加载本地打包的引擎（首次从网络下载模型文件，约 10-30 秒）
import("../assets/ocr/paddle/ocr.bundle.mjs")
  .then(function (m) {
    ocrMod = m;
    // 预加载模型（det + rec），后台进行，识别时若未完成会等待
    return m.init().then(function () {
      initialized = true;
    });
  })
  .catch(function (e) {
    loadError = (e && e.message) ? e.message : String(e);
    console.error("PaddleOCR 引擎加载失败:", e);
  });

// 供传统脚本（report-detail.js）调用的识别入口
window.runPaddleOCR = async function (dataUrl) {
  if (loadError) throw new Error(loadError);
  if (!ocrMod) throw new Error("引擎尚未加载完成");
  if (!initialized) await ocrMod.init();

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
