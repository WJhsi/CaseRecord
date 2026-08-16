/* ==========================================================
   CaseRecord · 首页
   已有档案时，主按钮改为进入个人界面（档案存 JSON 文件）
   加载完成前按钮显示「…」占位，避免文案切换闪烁
   ========================================================== */
(function () {
  "use strict";

  var cta = document.getElementById("main-cta");
  var secondary = document.getElementById("main-secondary");
  if (!cta || !secondary) return;

  var ctaText = cta.querySelector(".cta-text");

  // 加载完成前：占位文案 + 禁用点击，防止闪烁
  ctaText.textContent = "…";
  cta.classList.add("loading");
  cta.style.pointerEvents = "none";

  Store.migrateOnce()
    .then(function () {
      return Store.getProfile();
    })
    .then(function (p) {
      if (p && p.name) {
        cta.href = "dashboard.html";
        ctaText.textContent = "进入个人主页";
        secondary.textContent = "编辑个人档案";
        secondary.href = "profile.html";
      } else {
        ctaText.textContent = "创建个人档案";
      }
    })
    .catch(function () {
      // 未通过本地服务器打开时，回退默认文案
      ctaText.textContent = "创建个人档案";
    })
    .finally(function () {
      cta.classList.remove("loading");
      cta.style.pointerEvents = "";
    });
})();
