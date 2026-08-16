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
  var slider = toggle.querySelector(".theme-slider");

  function apply(theme, animate) {
    var dark = theme === "dark";
    // 滑块 + 按钮高亮
    toggle.classList.toggle("dark", dark);
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-theme") === theme;
      btn.classList.toggle("active", active);
    });
    // 深色配色作用到 body
    document.body.classList.toggle("dark", dark);
    // JS 直接控制滑块位置（不依赖 CSS transform 百分比）
    if (slider) {
      var btnW = 42;
      var gap = 0;
      var target = dark ? btnW + gap : 0;
      if (animate === false) {
        slider.style.transition = "none";
      } else {
        slider.style.transition = "";
      }
      slider.style.transform = "translateX(" + target + "px)";
    }
  }

  // 初始状态：读取记忆的选择（默认浅色）
  var saved = "light";
  try {
    saved = localStorage.getItem(KEY) || "light";
  } catch (e) {
    /* ignore */
  }
  apply(saved, false);

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var theme = btn.getAttribute("data-theme") || "light";
      apply(theme, true);
      try {
        localStorage.setItem(KEY, theme);
      } catch (e) {
        /* ignore */
      }
    });
  });
})();
