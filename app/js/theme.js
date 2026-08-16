/* ==========================================================
   CaseRecord · 主题切换（浅色 / 深色）
   切换效果：以药丸为中心，圆圈只在背景层辐射扩散（不盖住卡片）
   滑块滑动、按钮高亮、选择记忆、防闪白
   ========================================================== */
(function () {
  "use strict";

  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  var KEY = "caseRecord.theme";
  var buttons = toggle.querySelectorAll(".theme-btn");
  var slider = toggle.querySelector(".theme-slider");

  // 两套主题的背景色（辐射圆的颜色，与 CSS 定义一致）
  var BG = {
    light: "#f6f5f2",
    dark: "#151517"
  };

  var REVEAL_MS = 650;

  // 以药丸中心为圆心，背景层辐射扩散圆（z-index:0，在内容下、html 背景上）
  // 扩散的同时切换主题类并启用全局颜色过渡，卡片与背景同步变色
  function revealAndSwitch(theme) {
    var rect = toggle.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var w = Math.max(cx, window.innerWidth - cx);
    var h = Math.max(cy, window.innerHeight - cy);
    var r = Math.sqrt(w * w + h * h) + 20;

    var circle = document.createElement("div");
    circle.className = "theme-reveal";
    circle.style.cssText =
      "position:fixed;left:0;top:0;width:100vw;height:100vh;" +
      "z-index:0;pointer-events:none;" +
      "background:" + BG[theme] + ";" +
      "clip-path:circle(0px at " + cx + "px " + cy + "px);" +
      "transition:clip-path " + REVEAL_MS + "ms cubic-bezier(0.4,0,0.2,1);";
    document.body.appendChild(circle);

    // 启用全局颜色过渡（卡片/背景/边框同步变色，避免割裂）
    document.documentElement.classList.add("theme-transitioning");

    // 强制回流后触发扩散，同时切换主题类（颜色过渡与圆扩散同步进行）
    void circle.offsetWidth;
    circle.style.clipPath = "circle(" + r + "px at " + cx + "px " + cy + "px)";
    document.documentElement.classList.toggle("dark", theme === "dark");

    // 动画结束：移除圆 + 关闭全局过渡
    setTimeout(function () {
      circle.remove();
      document.documentElement.classList.remove("theme-transitioning");
    }, REVEAL_MS + 80);
  }

  function apply(theme, animate) {
    var dark = theme === "dark";

    // 滑块 + 按钮高亮（立即）
    toggle.classList.toggle("dark", dark);
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-theme") === theme;
      btn.classList.toggle("active", active);
    });

    // 滑块位置（JS 像素控制）
    if (slider) {
      var btnW = 42;
      var target = dark ? btnW : 0;
      if (animate === false) {
        slider.style.transition = "none";
      } else {
        slider.style.transition = "";
      }
      slider.style.transform = "translateX(" + target + "px)";
    }

    // 用户点击切换：背景层辐射扩散，扩散完成后再切换 html.dark
    if (animate) {
      revealAndSwitch(theme);
    } else {
      // 首屏按记忆加载：无动画，直接应用（head 脚本已设 html.dark 防闪白）
      document.documentElement.classList.toggle("dark", dark);
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
