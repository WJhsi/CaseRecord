/* ==========================================================
   CaseRecord · 主题切换（浅色 / 深色）
   切换交互 + 基础深色配色：滑块滑动、按钮高亮、选择记忆
   ========================================================== */
(function () {
  "use strict";

  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  var KEY = "caseRecord.theme";
  var buttons = toggle.querySelectorAll(".theme-btn");

  function apply(theme) {
    var dark = theme === "dark";
    // 滑块 + 按钮高亮
    toggle.classList.toggle("dark", dark);
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-theme") === theme;
      btn.classList.toggle("active", active);
    });
    // 深色配色作用到 body
    document.body.classList.toggle("dark", dark);
  }

  // 初始状态：读取记忆的选择（默认浅色）
  var saved = "light";
  try {
    saved = localStorage.getItem(KEY) || "light";
  } catch (e) {
    /* ignore */
  }
  apply(saved);

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var theme = btn.getAttribute("data-theme") || "light";
      apply(theme);
      try {
        localStorage.setItem(KEY, theme);
      } catch (e) {
        /* ignore */
      }
    });
  });
})();
