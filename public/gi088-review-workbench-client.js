(() => {
  const token = new URL(location.href).searchParams.get("token") || "";
  const $ = (id) => document.getElementById(id);
  const stageMeta = {
    candidate: { label: "候选质量", summaryKey: "candidate", orderKey: "candidate" },
    golden_a: { label: "Golden A", summaryKey: "goldenA", orderKey: "goldenA" },
    golden_b: { label: "Golden B", summaryKey: "goldenB", orderKey: "goldenB" }
  };
  const verdictOptions = [
    ["direct_use", "可直接用", "这条回应可以原样进入产品体验"],
    ["minor_issue", "轻微问题", "主线可用，存在局部表达或负担问题"],
    ["quality_failure", "质量失败", "需要调整策略、任务或回应方向"],
    ["uncertain", "不确定", "材料暂时不足，需要稍后复核"]
  ];
  const categories = [
    ["none", "请选择"],
    ["reask_answered_content", "重复已有答案"],
    ["working_task_drift", "共同任务漂移"],
    ["unsupported_third_party_inference", "缺乏证据的第三方推断"],
    ["low_information_gain", "信息增量低"],
    ["answer_burden", "回答负担高"],
    ["contract_or_data", "合同或数据问题"]
  ];
  let bundle;
  let draft;
  let summary;
  let showPendingOnly = false;
  let saveTimer = null;
  let saving = false;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(options.headers || {})
      }
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "保存失败");
    return value;
  }

  const idsForStage = (stage) => bundle.order[stageMeta[stage].orderKey];
  const currentIds = () => idsForStage(draft.currentStage);
  const currentIndex = () =>
    Math.max(0, currentIds().indexOf(draft.currentItemId));
  const storageKey = () =>
    `daily-light:gi088-review:${bundle.bundleFingerprint}`;

  function complete(entry, stage) {
    if (!entry) return false;
    if (entry.verdict === "direct_use") {
      return entry.category === "none" && !entry.blocker;
    }
    if (stage !== "candidate" && entry.verdict === "uncertain") return false;
    const length = [...entry.reason.trim()].length;
    return (
      entry.category !== "none" &&
      length >= 8 &&
      length <= 300 &&
      (!entry.blocker || entry.verdict === "quality_failure")
    );
  }

  function stamp(iso) {
    if (!iso) return "尚未保存";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(iso));
  }

  function currentItem() {
    if (draft.currentStage === "candidate") {
      return bundle.candidateItems.find(
        (item) => item.reviewId === draft.currentItemId
      );
    }
    return bundle.goldenRounds
      .flatMap((round) => round.items)
      .find((item) => item.sampleId === draft.currentItemId);
  }

  function recalculate() {
    const count = (ids, stage) =>
      ids.filter((id) => complete(draft.entries[id], stage)).length;
    summary = {
      candidate: { completed: count(bundle.order.candidate, "candidate"), total: 80 },
      goldenA: { completed: count(bundle.order.goldenA, "golden_a"), total: 20 },
      goldenB: { completed: count(bundle.order.goldenB, "golden_b"), total: 20 }
    };
  }

  function showError(message) {
    $("error").textContent = message;
  }

  function openReviewPanel() {
    document.querySelector(".review").classList.add("open");
    $("mobileReviewToggle").setAttribute("aria-expanded", "true");
    $("verdicts").querySelector("button")?.focus();
  }

  function closeReviewPanel() {
    document.querySelector(".review").classList.remove("open");
    $("mobileReviewToggle").setAttribute("aria-expanded", "false");
    $("mobileReviewToggle").focus();
  }

  function switchStage(stage) {
    if (stage === "golden_a" && summary.candidate.completed < 80) {
      showError("请先完成 80 份候选质量裁决");
      return;
    }
    if (stage === "golden_b" && summary.goldenA.completed < 20) {
      showError("请先完成并封存 Golden A");
      return;
    }
    draft.currentStage = stage;
    draft.currentItemId =
      idsForStage(stage).find((id) => !complete(draft.entries[id], stage)) ||
      idsForStage(stage)[0];
    render();
    queueSave();
  }

  function renderStages() {
    recalculate();
    $("stages").innerHTML = [
      ["candidate", "candidate"],
      ["golden_a", "goldenA"],
      ["golden_b", "goldenB"]
    ]
      .map(
        ([stage, key]) =>
          `<button class="stage ${draft.currentStage === stage ? "active" : ""}" data-stage="${stage}" ${stage === "golden_b" && summary.goldenA.completed < 20 ? "disabled" : ""}><strong>${stageMeta[stage].label}</strong><span>${summary[key].completed}/${summary[key].total}</span></button>`
      )
      .join("");
    document.querySelectorAll("[data-stage]").forEach((element) => {
      element.onclick = () => switchStage(element.dataset.stage);
    });
  }

  function renderQueue() {
    const ids = currentIds();
    $("queueTitle").textContent = stageMeta[draft.currentStage].label;
    const shown = showPendingOnly
      ? ids.filter((id) => !complete(draft.entries[id], draft.currentStage))
      : ids;
    $("queue").innerHTML = shown
      .map((id) => {
        const original = ids.indexOf(id);
        const done = complete(draft.entries[id], draft.currentStage);
        return `<button class="queue-item ${done ? "done" : ""} ${id === draft.currentItemId ? "current" : ""}" data-id="${id}" aria-label="第 ${original + 1} 条，${done ? "已评" : "待评"}">${original + 1}</button>`;
      })
      .join("");
    document.querySelectorAll("[data-id]").forEach((element) => {
      element.onclick = () => {
        draft.currentItemId = element.dataset.id;
        render();
      };
    });
  }

  function escapeText(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[character]
    );
  }

  function renderDialogue() {
    const item = currentItem();
    const position = currentIndex() + 1;
    $("itemEyebrow").textContent =
      `${stageMeta[draft.currentStage].label} · 第 ${position} 条`;
    $("mobilePosition").textContent = `${position} / ${currentIds().length}`;
    $("workingTask").textContent =
      item.workingTask || "依据完整对话判断本轮回应是否推进用户当前任务";
    $("dialogue").innerHTML = item.checkpoints
      .map(
        (checkpoint, index) =>
          `<article class="checkpoint"><div class="checkpoint-label">${item.checkpoints.length > 1 ? `轨迹检查点 ${index + 1}` : "完整用户可见对话"}</div>${checkpoint.visibleConversation.map((message) => `<div class="bubble ${message.role}">${escapeText(message.content)}</div>`).join("")}<div class="candidate"><div class="label">候选回应</div>${checkpoint.candidateVisibleOutput?.understanding ? `<p class="understanding">${escapeText(checkpoint.candidateVisibleOutput.understanding)}</p>` : ""}<p class="response">${escapeText(checkpoint.candidateVisibleOutput?.response || "候选未产生可见回应")}</p></div></article>`
      )
      .join("");
    $("trace").textContent = JSON.stringify(
      item.checkpoints.map((checkpoint) => checkpoint.safeTrace),
      null,
      2
    );
    $("dialogue").scrollTop = 0;
  }

  function renderReview() {
    const entry = draft.entries[draft.currentItemId] || {
      verdict: null,
      category: "none",
      blocker: false,
      reason: "",
      reviewedAt: null
    };
    $("verdicts").innerHTML = verdictOptions
      .map(
        ([value, label, description], index) =>
          `<button class="verdict ${entry.verdict === value ? "selected" : ""}" data-verdict="${value}"><strong>${index + 1}. ${label}</strong><span>${description}</span></button>`
      )
      .join("");
    document.querySelectorAll("[data-verdict]").forEach((element) => {
      element.onclick = () => chooseVerdict(element.dataset.verdict);
    });
    const issue = entry.verdict && entry.verdict !== "direct_use";
    $("details").hidden = !issue;
    $("category").innerHTML = categories
      .map(
        ([value, label]) =>
          `<option value="${value}" ${entry.category === value ? "selected" : ""}>${label}</option>`
      )
      .join("");
    $("reason").value = entry.reason || "";
    $("reasonCount").textContent = `${[...(entry.reason || "")].length} / 300`;
    $("blocker").checked = Boolean(entry.blocker);
    $("blockerLabel").hidden = entry.verdict !== "quality_failure";
    $("saveNext").disabled = !complete(entry, draft.currentStage);
    const allDone =
      summary.candidate.completed === 80 &&
      summary.goldenA.completed === 20 &&
      summary.goldenB.completed === 20;
    $("finalize").hidden = !allDone;
  }

  function chooseVerdict(verdict) {
    const existing = draft.entries[draft.currentItemId] || {};
    draft.entries[draft.currentItemId] = {
      verdict,
      category: verdict === "direct_use" ? "none" : existing.category || "none",
      blocker:
        verdict === "quality_failure" ? Boolean(existing.blocker) : false,
      reason: verdict === "direct_use" ? "" : existing.reason || "",
      reviewedAt: new Date().toISOString()
    };
    recalculate();
    render();
    queueSave();
    if (verdict === "direct_use") saveAndNext();
  }

  function updateDetails() {
    const entry = draft.entries[draft.currentItemId];
    if (!entry) return;
    entry.category = $("category").value;
    entry.reason = $("reason").value;
    entry.blocker =
      entry.verdict === "quality_failure" && $("blocker").checked;
    entry.reviewedAt = new Date().toISOString();
    $("reasonCount").textContent = `${[...entry.reason].length} / 300`;
    $("saveNext").disabled = !complete(entry, draft.currentStage);
    queueSave();
  }

  function move(delta) {
    const ids = showPendingOnly
      ? currentIds().filter(
          (id) => !complete(draft.entries[id], draft.currentStage)
        )
      : currentIds();
    let index = ids.indexOf(draft.currentItemId);
    if (index < 0) index = 0;
    draft.currentItemId =
      ids[Math.max(0, Math.min(ids.length - 1, index + delta))] ||
      draft.currentItemId;
    render();
    queueSave();
  }

  function saveAndNext() {
    const entry = draft.entries[draft.currentItemId];
    if (!complete(entry, draft.currentStage)) {
      showError("请先补全主要原因和 8–300 字理由");
      return;
    }
    const pending = currentIds().filter(
      (id) => !complete(draft.entries[id], draft.currentStage)
    );
    if (pending.length) {
      draft.currentItemId = pending[0];
    } else if (draft.currentStage === "candidate") {
      draft.currentStage = "golden_a";
      draft.currentItemId = bundle.order.goldenA[0];
    } else if (draft.currentStage === "golden_a") {
      draft.currentStage = "golden_b";
      draft.currentItemId = bundle.order.goldenB[0];
    }
    render();
    saveNow();
    if (matchMedia("(max-width: 1100px)").matches) closeReviewPanel();
  }

  function queueSave() {
    localStorage.setItem(storageKey(), JSON.stringify(draft));
    $("saveState").innerHTML =
      "<strong>正在保存</strong><span>浏览器副本已保留</span>";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  async function saveNow() {
    if (saving) return;
    saving = true;
    draft.savedAt = new Date().toISOString();
    try {
      await api("/api/local/gi088-v8r3/review-draft", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      $("saveState").innerHTML =
        `<strong>已自动保存</strong><span>${stamp(draft.savedAt)}</span>`;
      showError("");
    } catch (error) {
      $("saveState").innerHTML =
        "<strong>磁盘保存失败</strong><span>浏览器副本仍在，可点击任意裁决重试</span>";
      showError(error.message);
    } finally {
      saving = false;
    }
  }

  async function finalize() {
    try {
      $("finalize").disabled = true;
      $("saveState").innerHTML =
        "<strong>正在生成正式收据</strong><span>请稍候</span>";
      const result = await api("/api/local/gi088-v8r3/review-finalize", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      $("saveState").innerHTML =
        "<strong>已交给 Codex</strong><span>正式收据已生成</span>";
      $("error").textContent =
        `完成：候选 ${result.receipt.completeness.candidate}，Golden A ${result.receipt.completeness.goldenA}，Golden B ${result.receipt.completeness.goldenB}`;
    } catch (error) {
      $("finalize").disabled = false;
      showError(error.message);
    }
  }

  function render() {
    recalculate();
    renderStages();
    renderQueue();
    renderDialogue();
    renderReview();
    $("filterButton").textContent = showPendingOnly ? "显示全部" : "只看待评";
  }

  async function initialize() {
    try {
      const data = await api("/api/local/gi088-v8r3/review-session");
      bundle = data.bundle;
      draft = data.draft;
      const backup = localStorage.getItem(storageKey());
      if (backup) {
        try {
          const local = JSON.parse(backup);
          if (
            local.bundleFingerprint === bundle.bundleFingerprint &&
            Date.parse(local.savedAt) > Date.parse(draft.savedAt)
          ) {
            draft = local;
          }
        } catch {
          // A malformed browser backup never replaces the validated disk draft.
        }
      }
      render();
      $("saveState").innerHTML =
        `<strong>进度已恢复</strong><span>${stamp(draft.savedAt)}</span>`;
    } catch (error) {
      document.body.innerHTML =
        `<main style="padding:40px"><h1>裁决台无法打开</h1><p>${escapeText(error.message)}</p></main>`;
    }
  }

  $("filterButton").onclick = () => {
    showPendingOnly = !showPendingOnly;
    renderQueue();
  };
  $("mobileReviewToggle").onclick = openReviewPanel;
  $("closeReview").onclick = closeReviewPanel;
  $("previous").onclick = () => move(-1);
  $("previousMobile").onclick = () => move(-1);
  $("nextMobile").onclick = () => move(1);
  $("saveNext").onclick = saveAndNext;
  $("finalize").onclick = finalize;
  $("category").onchange = updateDetails;
  $("reason").oninput = updateDetails;
  $("blocker").onchange = updateDetails;
  document.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (["1", "2", "3", "4"].includes(event.key)) {
      chooseVerdict(verdictOptions[Number(event.key) - 1][0]);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      saveAndNext();
    }
  });
  initialize();
})();
