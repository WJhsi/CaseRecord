/* ==========================================================
   CaseRecord · 个人界面
   渲染已保存的个人档案；无档案时回到首页
   ========================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "caseRecord.profile";

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  // 病例保存成功提示
  var toast = document.getElementById("toast");

  function showToast(msg, type) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast " + (type || "ok") + " show";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove("show");
    }, 2800);
  }

  var p = readSaved();
  if (!p || !p.name) {
    window.location.replace("index.html");
    return;
  }

  // 头像：姓名首字
  $("avatar").textContent = p.name.charAt(0);
  $("p-name").textContent = p.name;

  // 标签：性别 · 年龄 · 血型
  var chips = [];
  if (p.gender) chips.push(p.gender);
  if (p.age != null) chips.push(p.age + " 岁");
  if (p.blood && p.blood !== "未知") chips.push(p.blood + " 型");
  $("p-chips").innerHTML = chips
    .map(function (c) {
      return '<span class="chip">' + c + "</span>";
    })
    .join("");

  // 体征信息
  $("p-gender").textContent = p.gender || "—";
  $("p-birth").textContent = p.birth || "—";
  $("p-blood").textContent = p.blood && p.blood !== "未知" ? p.blood + " 型" : "—";
  $("p-height").textContent = p.height ? p.height + " cm" : "—";
  $("p-weight").textContent = p.weight ? p.weight + " kg" : "—";

  // 病史信息
  $("p-history").textContent = p.history || "—";
  $("p-allergy").textContent = p.allergy || "—";
  $("p-notes").textContent = p.notes || "—";

  // 保存时间
  if (p.savedAt) {
    var d = new Date(p.savedAt);
    $("saved-at").textContent = "档案保存于 " + d.toLocaleString("zh-CN");
  }

  var STORAGE_KEY = "caseRecord.profile";
  var CASES_KEY = "caseRecord.cases";

  function readCases() {
    try {
      var arr = JSON.parse(localStorage.getItem(CASES_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 病例列表 ---------- */

  function renderCases() {
    var list = readCases();
    var section = $("cases-section");
    if (!section) return;
    if (!list.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    $("cases-count").textContent = "共 " + list.length + " 条";

    var html = list
      .slice()
      .reverse()
      .map(function (c) {
        var d = new Date(c.createdAt);
        var dateStr =
          d.toLocaleDateString("zh-CN") +
          " " +
          d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        var tags = [];
        if (c.images && c.images.length) tags.push(c.images.length + " 张影像");
        if (c.meds && c.meds.length) tags.push(c.meds.length + " 种药物");
        var tagsHtml = tags
          .map(function (t) {
            return '<span class="chip">' + t + "</span>";
          })
          .join("");
        return (
          '<a class="case-item" href="case-detail.html?id=' + c.id + '">' +
          '<div class="case-left">' +
          '<div class="case-date">' + dateStr + "</div>" +
          '<div class="case-cond">' + escapeHtml(c.condition) + "</div>" +
          "</div>" +
          '<div class="case-tags">' + tagsHtml + "</div>" +
          "</a>"
        );
      })
      .join("");
    $("cases-list").innerHTML = html;
  }

  // 从添加病例页保存后跳转回来时提示
  if (/[?&]saved=1/.test(window.location.search)) {
    showToast("病例已保存 ✓");
  }

  renderCases();
})();
