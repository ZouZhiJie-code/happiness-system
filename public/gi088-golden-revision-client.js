(() => {
  const token = new URL(location.href).searchParams.get("token") || "";
  const $ = (id) => document.getElementById(id);
  const stageMeta = {
    golden_a: { label: "Golden A 替换", orderKey: "goldenA" },
    golden_b: { label: "Golden B 替换", orderKey: "goldenB" }
  };
  const verdictOptions = [
    ["direct_use", "可直接用", "这条回应可以原样作为合格校准样本"],
    ["minor_issue", "轻微问题", "主线可用，存在局部表达或负担问题"],
    ["quality_failure", "质量失败", "这条回应存在明确的产品质量问题"],
    ["uncertain", "不确定", "可暂存，完成替换前需要形成明确判断"]
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
  const currentIndex = () => Math.max(0, currentIds().indexOf(draft.currentItemId));
  const storageKey = () =>
    `daily-light:gi088-golden-revision:${bundle.bundleFingerprint}`;

  function complete(entry) {
    if (!entry) return false;
    if (entry.verdict === "direct_use") {
      return entry.category === "none" && !entry.blocker;
    }
    if (entry.verdict === "uncertain") return false;
    const length = [...entry.reason.trim()].length;
    return (
      entry.category !== "none" &&
      length >= 8 &&
      length <= 300 &&
      (!entry.blocker || entry.verdict === "quality_failure")
    );
  }

  function summary() {
    const a = bundle.order.goldenA.filter((id) => complete(draft.entries[id])).length;
    const b = bundle.order.goldenB.filter((id) => complete(draft.entries[id])).length;
    return { a, b, all: a + b };
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

  function currentReplacement() {
    return bundle.replacementRounds
      .flatMap((round) => round.items)
      .find((replacement) => replacement.item.sampleId === draft.currentItemId);
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
    const progress = summary();
    if (stage === "golden_b" && progress.a < 3) {
      showError("请先完成 Golden A 的 3 条替换裁决");
      return;
    }
    draft.currentStage = stage;
    draft.currentItemId =
      idsForStage(stage).find((id) => !complete(draft.entries[id])) ||
      idsForStage(stage)[0];
    render();
    queueSave();
  }

  function renderStages() {
    const progress = summary();
    $("totalProgress").textContent = `${progress.all}/8`;
    $("retainedProgress").textContent = "沿用 32/32";
    $("stages").innerHTML = [
      ["golden_a", progress.a, 3],
      ["golden_b", progress.b, 5]
    ]
      .map(
        ([stage, completed, total]) =>
          `<button class="stage ${draft.currentStage === stage ? "active" : ""}" data-stage="${stage}" ${stage === "golden_b" && progress.a < 3 ? "disabled" : ""}><strong>${stageMeta[stage].label}</strong><span>${completed}/${total}</span></button>`
      )
      .join("");
    document.querySelectorAll("[data-stage]").forEach((element) => {
      element.onclick = () => switchStage(element.dataset.stage);
    });
  }

  function renderQueue() {
    const ids = currentIds();
    const shown = showPendingOnly
      ? ids.filter((id) => !complete(draft.entries[id]))
      : ids;
    $("queueTitle").textContent = stageMeta[draft.currentStage].label;
    $("queue").innerHTML = shown
      .map((id) => {
        const position = ids.indexOf(id) + 1;
        const done = complete(draft.entries[id]);
        return `<button class="queue-item ${done ? "done" : ""} ${id === draft.currentItemId ? "current" : ""}" data-id="${id}" aria-label="第 ${position} 条，${done ? "已评" : "待评"}">${position}</button>`;
      })
      .join("");
    document.querySelectorAll("[data-id]").forEach((element) => {
      element.onclick = () => {
        draft.currentItemId = element.dataset.id;
        render();
      };
    });
  }

  function renderDialogue() {
    const replacement = currentReplacement();
    const item = replacement.item;
    const position = currentIndex() + 1;
    $("itemEyebrow").textContent =
      `${stageMeta[draft.currentStage].label} · 第 ${position} 条`;
    $("mobilePosition").textContent = `${position} / ${currentIds().length}`;
    $("workingTask").textContent =
      item.workingTask || "依据完整对话判断本轮回应是否推进用户当前任务";
    $("dialogue").innerHTML = item.checkpoints
      .map(
        (checkpoint, index) =>
          `<article class="checkpoint"><div class="checkpoint-label">${item.checkpoints.length > 1 ? `轨迹检查点 ${index + 1}` : "完整用户可见对话"}</div>${checkpoint.visibleConversation.map((message) => `<div class="bubble ${message.role}">${escapeText(message.content)}</div>`).join("")}<div class="candidate"><div class="label">待裁决回应</div>${checkpoint.candidateVisibleOutput?.understanding ? `<p class="understanding">${escapeText(checkpoint.candidateVisibleOutput.understanding)}</p>` : ""}<p class="response">${escapeText(checkpoint.candidateVisibleOutput?.response || "本轮未产生可见回应")}</p></div></article>`
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
    $("saveNext").disabled = !complete(entry);
    $("finalize").hidden = summary().all !== 8;
  }

  function chooseVerdict(verdict) {
    const existing = draft.entries[draft.currentItemId] || {};
    draft.entries[draft.currentItemId] = {
      verdict,
      category: verdict === "direct_use" ? "none" : existing.category || "none",
      blocker: verdict === "quality_failure" ? Boolean(existing.blocker) : false,
      reason: verdict === "direct_use" ? "" : existing.reason || "",
      reviewedAt: new Date().toISOString()
    };
    render();
    queueSave();
    if (verdict === "direct_use") void saveAndNext();
  }

  function updateDetails() {
    const entry = draft.entries[draft.currentItemId];
    if (!entry) return;
    entry.category = $("category").value;
    entry.reason = $("reason").value;
    entry.blocker = $("blocker").checked;
    entry.reviewedAt = new Date().toISOString();
    $("reasonCount").textContent = `${[...entry.reason].length} / 300`;
    $("saveNext").disabled = !complete(entry);
    queueSave();
  }

  function nextItem() {
    const ids = currentIds();
    const nextPending = ids.find((id) => !complete(draft.entries[id]));
    if (nextPending) {
      draft.currentItemId = nextPending;
      return;
    }
    if (draft.currentStage === "golden_a") {
      switchStage("golden_b");
      return;
    }
    draft.currentItemId = ids[Math.min(ids.length - 1, currentIndex() + 1)];
  }

  function move(delta) {
    const ids = currentIds();
    const nextIndex = Math.max(0, Math.min(ids.length - 1, currentIndex() + delta));
    draft.currentItemId = ids[nextIndex];
    render();
    queueSave();
  }

  async function persist() {
    if (saving) return;
    saving = true;
    draft.savedAt = new Date().toISOString();
    localStorage.setItem(storageKey(), JSON.stringify(draft));
    $("saveState").innerHTML = "<strong>正在保存</strong><span>本机进度已保留</span>";
    try {
      await api("/api/local/gi088-v8r3/golden-revision-draft", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      $("saveState").innerHTML = `<strong>已自动保存</strong><span>${stamp(draft.savedAt)}</span>`;
      showError("");
    } catch (error) {
      $("saveState").innerHTML = "<strong>本机副本已保留</strong><span>点击重试保存</span>";
      showError(`${error.message}。当前输入仍保留在浏览器中。`);
    } finally {
      saving = false;
    }
  }

  function queueSave() {
    localStorage.setItem(storageKey(), JSON.stringify(draft));
    $("saveState").innerHTML = "<strong>等待保存</strong><span>输入已在本机保留</span>";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), 180);
  }

  async function saveAndNext() {
    const entry = draft.entries[draft.currentItemId];
    if (!complete(entry)) {
      showError("请选择主要原因，并填写 8–300 字理由");
      return;
    }
    await persist();
    nextItem();
    render();
    queueSave();
  }

  async function finalize() {
    if (summary().all !== 8) {
      showError("请完成 8 条替换裁决后再交给 Codex");
      return;
    }
    $("finalize").disabled = true;
    $("finalize").textContent = "正在生成修订收据…";
    try {
      draft.savedAt = new Date().toISOString();
      const value = await api("/api/local/gi088-v8r3/golden-revision-finalize", {
        method: "POST",
        body: JSON.stringify(draft)
      });
      $("completed").hidden = false;
      $("completed").textContent =
        `完成：替换 8/8，沿用 32/32。收据已在本机生成（${value.receipt.outputSha256.revision.slice(0, 12)}…）。`;
      $("finalize").textContent = "已保存并交给 Codex";
      localStorage.removeItem(storageKey());
    } catch (error) {
      $("finalize").disabled = false;
      $("finalize").textContent = "保存并交给 Codex";
      showError(error.message);
    }
  }

  function render() {
    renderStages();
    renderQueue();
    renderDialogue();
    renderReview();
    showError("");
  }

  async function start() {
    try {
      const session = await api("/api/local/gi088-v8r3/golden-revision-session");
      bundle = session.bundle;
      draft = session.draft;
      const local = localStorage.getItem(storageKey());
      if (local) {
        try {
          const recovered = JSON.parse(local);
          if (
            recovered.bundleFingerprint === bundle.bundleFingerprint &&
            Date.parse(recovered.savedAt) > Date.parse(draft.savedAt)
          ) {
            draft = recovered;
          }
        } catch {
          localStorage.removeItem(storageKey());
        }
      }
      $("saveState").innerHTML = `<strong>已读取进度</strong><span>${stamp(draft.savedAt)}</span>`;
      render();
      if (session.finalized) {
        $("completed").hidden = false;
        $("completed").textContent = "本轮修订已经封存：替换 8/8，沿用 32/32。";
        $("finalize").hidden = true;
        document.querySelectorAll("button,textarea,select").forEach((element) => {
          if (!["previous", "previousMobile", "nextMobile", "closeReview", "mobileReviewToggle"].includes(element.id)) {
            element.disabled = true;
          }
        });
      }
    } catch (error) {
      showError(error.message);
      $("saveState").innerHTML = "<strong>读取失败</strong><span>请保留页面并联系 Codex</span>";
    }
  }

  $("filterButton").onclick = () => {
    showPendingOnly = !showPendingOnly;
    $("filterButton").textContent = showPendingOnly ? "显示全部" : "只看待评";
    renderQueue();
  };
  $("previous").onclick = () => move(-1);
  $("previousMobile").onclick = () => move(-1);
  $("nextMobile").onclick = () => move(1);
  $("saveNext").onclick = () => void saveAndNext();
  $("finalize").onclick = () => void finalize();
  $("category").onchange = updateDetails;
  $("reason").oninput = updateDetails;
  $("blocker").onchange = updateDetails;
  $("mobileReviewToggle").onclick = openReviewPanel;
  $("closeReview").onclick = closeReviewPanel;
  $("saveState").onclick = () => void persist();
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea,select,input")) return;
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (/^[1-4]$/u.test(event.key)) {
      chooseVerdict(verdictOptions[Number(event.key) - 1][0]);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void saveAndNext();
    }
  });

  void start();
})();
