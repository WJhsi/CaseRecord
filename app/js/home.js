/* ==========================================================
   CaseRecord · 首页
   已有档案时，主按钮改为进入个人界面（档案存 JSON 文件）
   ========================================================== */
(function () {
  "use strict";

  var cta = document.getElementById("main-cta");
  var secondary = document.getElementById("main-secondary");
  if (!cta || !secondary) return;

  Store.migrateOnce()
    .then(function () {
      return Store.getProfile();
    })
    .then(function (p) {
      if (p && p.name) {
        cta.href = "dashboard.html";
        cta.querySelector(".cta-text").textContent = "进入个人主页";
        secondary.textContent = "编辑个人档案";
        secondary.href = "profile.html";
      }
    })
    .catch(function () {
      /* 未通过本地服务器打开时忽略 */
    });
})();
