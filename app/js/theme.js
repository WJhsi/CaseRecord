/* ==========================================================
   CaseRecord · 主题切换（浅色 / 深色）
   切换效果：背景与全页面颜色平滑渐变过渡
   滑块滑动、按钮高亮、选择记忆、防闪白
   ========================================================== */
(function () {
  "use strict";

  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  var KEY = "caseRecord.theme";
  var buttons = toggle.querySelectorAll(".theme-btn");
  var slider = toggle.querySelector(".theme-slider");

  // 两套主题的颜色变量（与 CSS 中定义一致）
  var THEMES = {
    light: {
      "--bg": "#f6f5f2",
      "--card": "#ffffff",
      "--ink": "#1c1917",
      "--ink-2": "#79716b",
      "--ink-3": "#a8a29e",
      "--line": "#e7e5e4",
      "--accent": "#2f6f4f",
      "--accent-deep": "#20533a",
      "--accent-soft": "#e9f2ec",
      "--danger": "#b91c1c",
      "--field-bg": "#fcfcfa",
      "--well": "#f1f0ed",
      "--field-focus": "#ffffff",
      "--scroll-thumb": "#d4d2ce",
      "--scroll-thumb-hover": "#b8b5b0"
    },
    dark: {
      "--bg": "#151517",
      "--card": "#1b1b1c",
      "--ink": "#e8e8ea",
      "--ink-2": "#9a9a9f",
      "--ink-3": "#6b6b70",
      "--line": "#333336",
      "--accent": "#6fbf96",
      "--accent-deep": "#8ad2ab",
      "--accent-soft": "#223a2d",
      "--danger": "#e06a5c",
      "--field-bg": "#1f1f21",
      "--well": "#242426",
      "--field-focus": "#262629",
      "--scroll-thumb": "#3a3a3d",
      "--scroll-thumb-hover": "#4a4a4e"
    }
  };

  var COLOR_KEYS = Object.keys(THEMES.light);
  var DURATION = 600;

  // hex → [r,g,b]
  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16)
    ];
  }

  function rgbStr(rgb) {
    return "rgb(" + Math.round(rgb[0]) + ", " + Math.round(rgb[1]) + ", " + Math.round(rgb[2]) + ")";
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // 主题颜色渐变动画
  function animateTheme(from, to) {
    var start = null;
    var fromColors = THEMES[from];
    var toColors = THEMES[to];
    var root = document.documentElement;

    // 立即用起始色覆盖（防止先闪到目标色）
    COLOR_KEYS.forEach(function (key) {
      var rgb = hexToRgb(fromColors[key]);
      root.style.setProperty(key, rgbStr(rgb));
    });

    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / DURATION);
      // ease-in-out
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      COLOR_KEYS.forEach(function (key) {
        var fromRgb = hexToRgb(fromColors[key]);
        var toRgb = hexToRgb(toColors[key]);
        root.style.setProperty(
          key,
          rgbStr([lerp(fromRgb[0], toRgb[0], e), lerp(fromRgb[1], toRgb[1], e), lerp(fromRgb[2], toRgb[2], e)])
        );
      });

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // 动画结束：移除内联变量，让 CSS 规则（html.dark）接管最终值
        COLOR_KEYS.forEach(function (key) {
          root.style.removeProperty(key);
        });
      }
    }

    requestAnimationFrame(frame);
  }

  function apply(theme, animate) {
    var dark = theme === "dark";
    var prevTheme = toggle.classList.contains("dark") ? "dark" : "light";

    // 滑块 + 按钮高亮（立即）
    toggle.classList.toggle("dark", dark);
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-theme") === theme;
      btn.classList.toggle("active", active);
    });
    document.documentElement.classList.toggle("dark", dark);

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

    // 颜色渐变：从旧主题过渡到新主题（用户点击时；首屏加载不动画）
    if (animate && prevTheme !== theme) {
      animateTheme(prevTheme, theme);
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
