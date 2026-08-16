/* ==========================================================
   CaseRecord · 主题切换（浅色 / 深色）
   当前仅实现切换交互：滑块滑动、按钮高亮、选择记忆；
   深色主题样式暂未实现（页面视觉仍为浅色），后续补充。
   ========================================================== */
(function () {
  "use strict";

  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  var KEY = "caseRecord.theme";
  var buttons = toggle.querySelectorAll(".theme-btn");

  function apply(theme) {
    var dark = theme === "dark";
    toggle.classList.toggle("dark", dark);
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-theme") === theme;
      btn.classList.toggle("active", active);
    });
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
