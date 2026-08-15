// Case Record 骨架脚本
(function () {
  "use strict";

  var statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = "✅ 页面加载成功 — " + new Date().toLocaleString("zh-CN");
  }

  console.log("Case Record app started.");
})();
