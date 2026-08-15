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
})();
