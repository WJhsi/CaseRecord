/* ==========================================================
   CaseRecord · 首页
   已有档案时，主按钮改为进入个人界面
   ========================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "caseRecord.profile";

  var p = null;
  try {
    p = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    p = null;
  }

  var cta = document.getElementById("main-cta");
  var secondary = document.getElementById("main-secondary");
  if (!cta || !secondary) return;

  if (p && p.name) {
    cta.href = "dashboard.html";
    cta.querySelector(".cta-text").textContent = "进入个人主页";
    secondary.textContent = "编辑个人档案";
    secondary.href = "profile.html";
  }
})();
