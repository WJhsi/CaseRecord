/* ==========================================================
   CaseRecord · 公共数据层
   所有本地数据统一存为服务端 JSON 文件（不再使用 localStorage）：
   - 档案        data/profile.json
   - 病例        data/cases/<id>/case.json   （每病例一个文件夹）
   - 识别结果    data/cases/<id>/ocr-<idx>.json
   - AI 配置     data/ai-config.json
   首次使用时自动把旧 localStorage 数据迁移到 JSON 文件。
   ========================================================== */
(function () {
  "use strict";

  // 统一请求封装
  function req(method, url, data) {
    return fetch(url, {
      method: method,
      headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: data !== undefined ? JSON.stringify(data) : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("HTTP " + res.status + (t ? "：" + t.slice(0, 200) : ""));
        });
      }
      return res.json().catch(function () {
        return {};
      });
    });
  }

  /* ---------- 档案 ---------- */

  function getProfile() {
    return req("GET", "/api/profile").then(function (d) {
      return d && typeof d === "object" && Object.keys(d).length ? d : null;
    });
  }

  function saveProfile(p) {
    return req("POST", "/api/profile", p || {});
  }

  /* ---------- 病例 ---------- */

  function listCases() {
    return req("GET", "/api/cases").then(function (d) {
      return Array.isArray(d) ? d : [];
    });
  }

  function getCase(id) {
    return req("GET", "/api/cases/" + id).then(function (d) {
      return d && typeof d === "object" && d.id ? d : null;
    });
  }

  function saveCase(id, c) {
    return req("POST", "/api/cases/" + id, c);
  }

  function deleteCase(id) {
    return req("DELETE", "/api/cases/" + id);
  }

  /* ---------- 识别结果（每张报告一个 json） ---------- */

  function getOcr(caseId, idx) {
    return req("GET", "/api/cases/" + caseId + "/ocr/" + idx).then(function (d) {
      return d && typeof d === "object" && Object.keys(d).length ? d : null;
    });
  }

  function saveOcr(caseId, idx, data) {
    return req("POST", "/api/cases/" + caseId + "/ocr/" + idx, data || {});
  }

  /* ---------- 旧数据迁移（localStorage → JSON，只执行一次） ---------- */

  var MIGRATED_KEY = "caseRecord.migratedToJson";

  function migrateOnce() {
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }

    var tasks = [];

    // 档案
    try {
      var profile = localStorage.getItem("caseRecord.profile");
      if (profile) {
        var p = JSON.parse(profile);
        if (p && p.name) tasks.push(saveProfile(p));
      }
    } catch (e) {
      /* ignore */
    }

    // 病例（含每张报告的识别结果）
    try {
      var casesRaw = localStorage.getItem("caseRecord.cases");
      if (casesRaw) {
        var arr = JSON.parse(casesRaw);
        if (Array.isArray(arr) && arr.length) {
          arr.forEach(function (c) {
            if (!c || c.id == null) return;
            var cid = String(c.id);
            tasks.push(saveCase(cid, c));
            (c.images || []).forEach(function (im, idx) {
              if (im && im.ocr && typeof im.ocr === "object") {
                tasks.push(saveOcr(cid, idx, im.ocr));
              }
            });
          });
        }
      }
    } catch (e) {
      /* ignore */
    }

    return Promise.all(tasks)
      .then(function () {
        try {
          localStorage.setItem(MIGRATED_KEY, "1");
        } catch (e) {
          /* ignore */
        }
      })
      .catch(function () {
        /* 迁移失败不阻塞页面 */
      });
  }

  window.Store = {
    req: req,
    getProfile: getProfile,
    saveProfile: saveProfile,
    listCases: listCases,
    getCase: getCase,
    saveCase: saveCase,
    deleteCase: deleteCase,
    getOcr: getOcr,
    saveOcr: saveOcr,
    migrateOnce: migrateOnce
  };
})();
