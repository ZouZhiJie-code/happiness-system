import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FourClassVerdict =
  | "direct_use"
  | "minor_issue"
  | "quality_failure"
  | "single_case_blocker";

type BlindItem = {
  blindId: string;
  mode: string;
  userGoal: string;
  context: unknown;
  candidateResponse: unknown;
};

type GoldItem = {
  blindId: string;
  caseId: string;
  goldLabel: FourClassVerdict;
};

type Prediction = {
  verdict: FourClassVerdict;
  isBlocker: boolean;
  blockerType: string;
};

type ReviewItem = Omit<BlindItem, "blindId"> & {
  reviewId: string;
};

type SourcePaths = ReturnType<typeof resolvePaths>;

const PACK_VERSION = "2026-08-13.gi088-stage-c3-gold-review-v1";
const RANDOMIZATION_SEED = "2026-08-13.gi088-stage-c3-stop1-v1";
const CONTROL_CASE_IDS = ["JC-DU-02", "JC-DU-03", "JC-SB-01"] as const;

function resolvePaths(cwd = process.cwd()) {
  const assetRoot = path.join(
    cwd,
    "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1",
  );
  const sourcePrivate = path.join(assetRoot, ".private/judge-calibration-v2");
  const outputPrivate = path.join(assetRoot, ".private/judge-calibration-v3");
  const c2Run = path.join(
    sourcePrivate,
    "stage-c2-real-runs/stage-c2-2026-08-13T16-23-06-619Z",
  );
  return {
    assetRoot,
    sourcePrivate,
    outputPrivate,
    goldMapping: path.join(sourcePrivate, "gold-mapping.json"),
    blindPackage: path.join(sourcePrivate, "judge-blind-package.json"),
    attempts: path.join(c2Run, "attempts"),
    publicReceipt: path.join(assetRoot, "stage-c3-gold-review-receipt.json"),
    privatePack: path.join(outputPrivate, "product-owner-blind-review-pack.json"),
    privateAudit: path.join(outputPrivate, "selection-audit.json"),
    privateHtml: path.join(outputPrivate, "product-owner-blind-review.html"),
    privateValidation: path.join(outputPrivate, "validation-receipt.json"),
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileHash(filePath: string) {
  return stableHash(await readFile(filePath, "utf8"));
}

async function readPrediction(
  paths: SourcePaths,
  mode: "normal" | "thinking",
  blindId: string,
): Promise<Prediction> {
  const fileName = `qwen3.7-plus-2026-05-26__${mode}__${blindId}__attempt-1.result.json`;
  const result = await readJson<{
    outcome?: { kind?: string; prediction?: Prediction };
  }>(path.join(paths.attempts, fileName));
  if (result.outcome?.kind !== "valid" || !result.outcome.prediction) {
    throw new Error(`C2_RESULT_NOT_VALID:${mode}:${blindId}`);
  }
  return result.outcome.prediction;
}

function makeReviewHtml(pack: {
  packageVersion: string;
  packFingerprint: string;
  items: ReviewItem[];
}) {
  const embedded = JSON.stringify(pack).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:" />
  <title>GI-088 C3 产品负责人盲复核</title>
  <style>
    :root { color-scheme: light; --paper:#fffaf1; --ink:#342c24; --soft:#76695c; --line:#e7d8c6; --brand:#a95735; --wash:#f4e9dc; --ok:#2f6b4f; --warn:#9a5a1f; }
    * { box-sizing:border-box; }
    body { margin:0; background:#f2eadf; color:var(--ink); font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; }
    main { width:min(980px,calc(100% - 32px)); margin:32px auto 72px; }
    header,.card,.toolbar { background:var(--paper); border:1px solid var(--line); border-radius:20px; box-shadow:0 14px 40px rgba(72,51,33,.07); }
    header { padding:28px 30px; }
    h1 { margin:0 0 10px; font-size:28px; line-height:1.25; }
    h2 { margin:0 0 18px; font-size:21px; }
    p { margin:8px 0; }
    .muted { color:var(--soft); }
    .progress { height:10px; border-radius:99px; background:var(--wash); overflow:hidden; margin-top:18px; }
    .progress span { display:block; height:100%; background:var(--brand); transition:width .2s ease; }
    .card { margin-top:18px; padding:28px 30px; }
    .meta { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
    .pill { padding:4px 10px; border-radius:99px; background:var(--wash); color:var(--soft); font-size:13px; }
    .material { padding:18px; margin:14px 0; border-left:4px solid var(--brand); background:#fffdf8; white-space:pre-wrap; border-radius:0 12px 12px 0; }
    fieldset { border:0; padding:0; margin:24px 0 0; }
    legend { font-weight:700; margin-bottom:8px; }
    label.option { display:inline-flex; align-items:center; gap:7px; margin:5px 16px 5px 0; }
    textarea,select { width:100%; border:1px solid var(--line); border-radius:12px; background:#fff; color:var(--ink); padding:11px 12px; font:inherit; }
    textarea { min-height:88px; resize:vertical; }
    select { max-width:480px; }
    .derived { margin-top:22px; padding:14px 16px; background:var(--wash); border-radius:12px; }
    .derived strong { color:var(--brand); }
    .toolbar { position:sticky; bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; padding:14px 18px; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; }
    button { border:1px solid var(--line); border-radius:999px; padding:10px 17px; background:#fff; color:var(--ink); font:600 14px/1 inherit; cursor:pointer; }
    button.primary { background:var(--brand); border-color:var(--brand); color:#fff; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    .message { min-height:26px; margin-top:14px; color:var(--warn); }
    .message.ok { color:var(--ok); }
    @media (max-width:640px) { main{width:min(100% - 20px,980px);margin-top:10px} header,.card{padding:22px 18px}.toolbar{align-items:flex-start;flex-direction:column} }
  </style>
</head>
<body>
<main>
  <header>
    <h1>GI-088 C3｜14 张产品金标盲复核</h1>
    <p>这轮只看用户目标、必要语境和候选回应。页面不提供旧标签、模型配置和历史理由。</p>
    <p class="muted">请按当前产品判断逐张作答。内容只保存在本机浏览器，完成后导出结果文件。</p>
    <div class="progress"><span id="progressBar"></span></div>
    <p id="progressText" class="muted"></p>
  </header>
  <section id="reviewCard" class="card"></section>
  <p id="message" class="message"></p>
  <nav class="toolbar">
    <span id="position" class="muted"></span>
    <div class="actions">
      <button id="previous">上一张</button>
      <button id="next">保存并下一张</button>
      <button id="export" class="primary">导出 14 张裁决</button>
    </div>
  </nav>
</main>
<script>
const pack=${embedded};
const storageKey='gi088-stage-c3-gold-review:'+pack.packFingerprint;
const state=JSON.parse(localStorage.getItem(storageKey)||'{"answers":{},"index":0}');
const verdictNames={direct_use:'可直接使用',minor_issue:'轻微问题',quality_failure:'质量失败',single_case_blocker:'单例阻断',replace_case:'退出并替换'};
const esc=(value)=>String(value??'').replace(/[&<>\"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));
const show=(value)=>typeof value==='string'?value:JSON.stringify(value,null,2);
function emptyAnswer(){return {contextSufficient:'',requiredOutcome:'',blockerTriggered:'',blockerType:'none',coreGoalAchieved:'',informationGain:'',repairScope:'',shortestEvidence:'',ambiguity:'none'};}
function current(){const item=pack.items[state.index]; state.answers[item.reviewId]??=emptyAnswer(); return [item,state.answers[item.reviewId]];}
function persist(){localStorage.setItem(storageKey,JSON.stringify(state)); updateProgress();}
function derive(a){
  if(a.contextSufficient==='no'||a.ambiguity==='two_reasonable_interpretations') return 'replace_case';
  if(a.blockerTriggered==='yes') return 'single_case_blocker';
  if(a.coreGoalAchieved==='no'||a.repairScope==='response_replan') return 'quality_failure';
  if(a.coreGoalAchieved==='yes'&&a.repairScope==='local_edit') return 'minor_issue';
  if(a.coreGoalAchieved==='yes'&&a.repairScope==='none') return 'direct_use';
  return '';
}
function validate(a){
  const missing=[];
  if(!a.contextSufficient) missing.push('语境是否足够');
  if(a.requiredOutcome.trim().length<4) missing.push('用户本轮必须获得的结果');
  if(!a.blockerTriggered) missing.push('单例阻断判断');
  if(a.blockerTriggered==='yes'&&a.blockerType==='none') missing.push('阻断类型');
  if(a.blockerTriggered==='no'&&a.blockerType!=='none') missing.push('阻断类型需选“未触发”');
  if(!a.coreGoalAchieved) missing.push('核心目标判断');
  if(!a.informationGain) missing.push('信息增益判断');
  if(!a.repairScope) missing.push('修复范围');
  if(a.shortestEvidence.trim().length<4) missing.push('最短可见证据与理由');
  if(!derive(a)) missing.push('四档映射所需判断');
  return missing;
}
function completedCount(){return pack.items.filter(item=>validate(state.answers[item.reviewId]||emptyAnswer()).length===0).length;}
function updateProgress(){const done=completedCount(); document.querySelector('#progressBar').style.width=(done/pack.items.length*100)+'%'; document.querySelector('#progressText').textContent='已完成 '+done+' / '+pack.items.length; document.querySelector('#position').textContent='第 '+(state.index+1)+' / '+pack.items.length+' 张';}
function render(){
  const [item,a]=current();
  document.querySelector('#reviewCard').innerHTML=[
    '<div class="meta"><span class="pill">编号 '+esc(item.reviewId)+'</span><span class="pill">模式 '+esc(item.mode==='capture'?'帮我记':'陪我聊')+'</span></div>',
    '<h2>请只依据下面材料判断</h2>',
    '<p><strong>用户目标</strong></p><div class="material">'+esc(show(item.userGoal))+'</div>',
    '<p><strong>必要语境</strong></p><div class="material">'+esc(show(item.context))+'</div>',
    '<p><strong>候选回应</strong></p><div class="material">'+esc(show(item.candidateResponse))+'</div>',
    '<fieldset><legend>1. 当前语境足够支持稳定判断吗？</legend>'+radio('contextSufficient','yes','足够',a)+radio('contextSufficient','no','存在两种合理解释，建议退出金标',a)+'</fieldset>',
    '<fieldset><legend>2. 用户本轮必须获得什么结果？</legend><textarea data-field="requiredOutcome" placeholder="用一句话写清用户在这一轮真正需要得到什么">'+esc(a.requiredOutcome)+'</textarea></fieldset>',
    '<fieldset><legend>3. 是否触发单例阻断？</legend>'+radio('blockerTriggered','no','未触发',a)+radio('blockerTriggered','yes','已触发',a)+'<select data-field="blockerType"><option value="none">未触发</option><option value="correction_ignored">忽略纠正</option><option value="unsupported_inference">无来源编造或长期规律推断</option><option value="event_boundary">独立事件串线</option><option value="explicit_stop_ignored">明确停止后继续</option><option value="false_stop">普通内容被误判为停止</option><option value="other">其他阻断</option></select></fieldset>',
    '<fieldset><legend>4. 核心目标是否完成？</legend>'+radio('coreGoalAchieved','yes','完成',a)+radio('coreGoalAchieved','no','未完成',a)+'</fieldset>',
    '<fieldset><legend>5. 下一步的信息增益属于哪一类？</legend><select data-field="informationGain"><option value="">请选择</option><option value="new_material">获得新的事实、取舍、证据或认识</option><option value="semantic_repeat">换句话重复索取</option><option value="not_applicable">本例无需继续获取材料</option></select></fieldset>',
    '<fieldset><legend>6. 修复范围</legend><select data-field="repairScope"><option value="">请选择</option><option value="none">无需修改</option><option value="local_edit">局部修改</option><option value="response_replan">整轮重新规划</option></select></fieldset>',
    '<fieldset><legend>7. 最短可见证据与判断理由</legend><textarea data-field="shortestEvidence" placeholder="引用或概括最关键的一处可见证据，并说明它如何支持判断">'+esc(a.shortestEvidence)+'</textarea></fieldset>',
    '<fieldset><legend>8. 是否存在两种同样合理的产品解释？</legend><select data-field="ambiguity"><option value="none">没有，当前判断稳定</option><option value="two_reasonable_interpretations">有，建议退出并替换案例</option></select></fieldset>',
    '<div class="derived">当前映射结论：<strong>'+esc(verdictNames[derive(a)]||'完成判断后自动显示')+'</strong></div>'
  ].join('');
  for(const el of document.querySelectorAll('[data-field]')){
    el.value=a[el.dataset.field]||'';
    el.addEventListener('input',()=>{a[el.dataset.field]=el.value; persist(); renderDerived();});
    el.addEventListener('change',()=>{a[el.dataset.field]=el.value; persist(); renderDerived();});
  }
  for(const el of document.querySelectorAll('input[type=radio]')) el.addEventListener('change',()=>{a[el.name]=el.value;if(el.name==='blockerTriggered'&&el.value==='no')a.blockerType='none';persist();render();});
  document.querySelector('#previous').disabled=state.index===0;
  document.querySelector('#next').textContent=state.index===pack.items.length-1?'保存本张':'保存并下一张';
  updateProgress();
}
function radio(name,value,label,a){return '<label class="option"><input type="radio" name="'+name+'" value="'+value+'" '+(a[name]===value?'checked':'')+'>'+label+'</label>';}
function renderDerived(){const [,a]=current();document.querySelector('.derived strong').textContent=verdictNames[derive(a)]||'完成判断后自动显示';}
function message(text,ok=false){const el=document.querySelector('#message');el.textContent=text;el.className='message'+(ok?' ok':'');}
document.querySelector('#previous').addEventListener('click',()=>{persist();state.index=Math.max(0,state.index-1);render();message('');});
document.querySelector('#next').addEventListener('click',()=>{const [,a]=current();const missing=validate(a);if(missing.length){message('请补充：'+missing.join('、'));return;}persist();if(state.index<pack.items.length-1)state.index++;render();message('本张已保存。',true);});
document.querySelector('#export').addEventListener('click',()=>{
  persist(); const incomplete=pack.items.filter(item=>validate(state.answers[item.reviewId]||emptyAnswer()).length>0);
  if(incomplete.length){message('还有 '+incomplete.length+' 张未完成，请补齐后再导出。');return;}
  const output={schemaVersion:'1.0',reviewVersion:pack.packageVersion,packFingerprint:pack.packFingerprint,reviewerRole:'product_owner',completedAt:new Date().toISOString(),items:pack.items.map(item=>{const answer=state.answers[item.reviewId];return {reviewId:item.reviewId,...answer,derivedVerdict:derive(answer)};})};
  const blob=new Blob([JSON.stringify(output,null,2)+'\\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='gi088-stage-c3-product-owner-review.json';a.click();URL.revokeObjectURL(url);message('已导出。请保留这个结果文件，下一步用它冻结新金标。',true);
});
render();
</script>
</body>
</html>\n`;
}

export async function buildStageC3GoldReview(cwd = process.cwd()) {
  const paths = resolvePaths(cwd);
  const goldDocument = await readJson<{ items: GoldItem[] }>(paths.goldMapping);
  const blindDocument = await readJson<{ items: BlindItem[] }>(paths.blindPackage);
  const blindById = new Map(blindDocument.items.map((item) => [item.blindId, item]));

  const enriched = await Promise.all(
    goldDocument.items.map(async (gold) => {
      const blind = blindById.get(gold.blindId);
      if (!blind) throw new Error(`BLIND_ITEM_MISSING:${gold.blindId}`);
      const normal = await readPrediction(paths, "normal", gold.blindId);
      const thinking = await readPrediction(paths, "thinking", gold.blindId);
      return { gold, blind, normal, thinking };
    }),
  );

  const disagreements = enriched.filter(
    ({ gold, normal, thinking }) =>
      normal.verdict !== gold.goldLabel || thinking.verdict !== gold.goldLabel,
  );
  if (disagreements.length !== 11) {
    throw new Error(`C2_DISAGREEMENT_COUNT_MISMATCH:${disagreements.length}`);
  }

  const controls = CONTROL_CASE_IDS.map((caseId) => {
    const match = enriched.find(({ gold }) => gold.caseId === caseId);
    if (!match) throw new Error(`CONTROL_CASE_MISSING:${caseId}`);
    if (
      match.normal.verdict !== match.gold.goldLabel ||
      match.thinking.verdict !== match.gold.goldLabel
    ) {
      throw new Error(`CONTROL_CASE_NOT_STABLE:${caseId}`);
    }
    if (
      caseId === "JC-SB-01" &&
      (match.normal.blockerType !== "correction_ignored" ||
        match.thinking.blockerType !== "correction_ignored")
    ) {
      throw new Error(`CONTROL_BLOCKER_ANCHOR_NOT_STABLE:${caseId}`);
    }
    if (
      caseId.startsWith("JC-DU-") &&
      (match.normal.isBlocker || match.thinking.isBlocker)
    ) {
      throw new Error(`CONTROL_DIRECT_USE_BLOCKER_CONFLICT:${caseId}`);
    }
    return match;
  });

  const selected = [...disagreements, ...controls];
  if (new Set(selected.map(({ gold }) => gold.caseId)).size !== 14) {
    throw new Error("SELECTED_CASES_NOT_UNIQUE");
  }
  selected.sort((a, b) =>
    stableHash(`${RANDOMIZATION_SEED}:${a.gold.caseId}`).localeCompare(
      stableHash(`${RANDOMIZATION_SEED}:${b.gold.caseId}`),
    ),
  );

  const reviewItems: ReviewItem[] = selected.map(({ blind }, index) => ({
    reviewId: `C3-REV-${String(index + 1).padStart(3, "0")}`,
    mode: blind.mode,
    userGoal: blind.userGoal,
    context: blind.context,
    candidateResponse: blind.candidateResponse,
  }));
  const packCore = {
    schemaVersion: "1.0",
    packageVersion: PACK_VERSION,
    purpose: "product_owner_blind_gold_health_check_before_judge_v2",
    instructions: {
      hiddenFromReviewer: [
        "source_case_id",
        "historical_blind_id",
        "historical_gold",
        "model_configuration",
        "model_prediction",
        "historical_reason",
        "technical_result",
      ],
      decisionAxes: [
        "context_sufficiency",
        "required_user_outcome",
        "single_case_blocker",
        "core_goal_achievement",
        "information_gain",
        "repair_scope",
      ],
    },
    items: reviewItems,
  };
  const packFingerprint = stableHash(JSON.stringify(packCore));
  const pack = { ...packCore, packFingerprint };

  const audit = {
    schemaVersion: "1.0",
    auditVersion: PACK_VERSION,
    access: "private_product_owner_and_evaluation_maintainer_only",
    selectionRule: {
      disagreements: "union_of_plus_normal_or_thinking_four_class_mismatch_against_c2_gold",
      controls: {
        caseIds: [...CONTROL_CASE_IDS],
        reason: "two_stable_direct_use_product_anchors_and_one_stable_correction_blocker_anchor",
      },
      randomization: "sha256_sort_with_frozen_seed_then_replace_source_ids_with_opaque_review_ids",
    },
    items: selected.map(({ gold, normal, thinking }, index) => ({
      reviewId: `C3-REV-${String(index + 1).padStart(3, "0")}`,
      sourceBlindId: gold.blindId,
      sourceCaseId: gold.caseId,
      historicalGold: gold.goldLabel,
      c2Normal: { verdict: normal.verdict, blockerType: normal.blockerType },
      c2Thinking: { verdict: thinking.verdict, blockerType: thinking.blockerType },
      selectionRole: CONTROL_CASE_IDS.includes(
        gold.caseId as (typeof CONTROL_CASE_IDS)[number],
      )
        ? "stable_control"
        : "c2_disagreement",
    })),
  };

  const sourceIds = goldDocument.items.flatMap(({ caseId, blindId }) => [caseId, blindId]);
  const sourceTitles = (
    await readJson<{ cards: Array<{ caseId: string; title: string }> }>(
      path.join(paths.assetRoot, "judge-calibration-20.json"),
    )
  ).cards.map(({ title }) => title);
  const privatePayload = `${JSON.stringify(pack)}\n${makeReviewHtml(pack)}`;
  const leakedIdentifiers = [...sourceIds, ...sourceTitles].filter((value) =>
    privatePayload.includes(value),
  );
  if (leakedIdentifiers.length > 0) {
    throw new Error(`BLIND_REVIEW_LABEL_LEAK:${leakedIdentifiers.length}`);
  }

  await mkdir(paths.outputPrivate, { recursive: true });
  await writeFile(paths.privatePack, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  await writeFile(paths.privateAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await writeFile(paths.privateHtml, makeReviewHtml(pack), "utf8");

  const validation = {
    schemaVersion: "1.0",
    validationVersion: PACK_VERSION,
    status: "ready_for_product_owner_gold_review",
    itemCount: reviewItems.length,
    composition: { c2Disagreements: 11, stableDirectUseControls: 2, stableBlockerControls: 1 },
    uniqueReviewIds: new Set(reviewItems.map(({ reviewId }) => reviewId)).size,
    sourceIdentifierLeaks: leakedIdentifiers.length,
    historicalLabelsShownPerItem: 0,
    modelPredictionsShownPerItem: 0,
    externalNetworkDependencies: 0,
    judgeModelCalls: 0,
    businessModelCalls: 0,
    packFingerprint,
    sourceFingerprints: {
      goldMapping: await fileHash(paths.goldMapping),
      blindPackage: await fileHash(paths.blindPackage),
    },
  };
  await writeFile(paths.privateValidation, `${JSON.stringify(validation, null, 2)}\n`, "utf8");

  const publicReceipt = {
    schemaVersion: "1.0",
    receiptVersion: PACK_VERSION,
    status: "ready_for_product_owner_gold_review",
    decisionBoundary: "supports_only_product_owner_gold_health_check_before_judge_v2",
    itemCount: 14,
    composition: validation.composition,
    blindReview: {
      randomOrder: true,
      opaqueIds: true,
      sourceIdentifierLeaks: 0,
      historicalLabelsShownPerItem: 0,
      modelConfigurationShownPerItem: 0,
      historicalReasonsShownPerItem: 0,
      technicalResultsShownPerItem: 0,
    },
    privacy: {
      reviewBodyPublicFiles: 0,
      reviewBodyGitTrackedFiles: 0,
      privateDirectoryIgnoredByGit: true,
      browserNetworkDependencies: 0,
    },
    executionBoundary: {
      judgeModelCalls: 0,
      businessModelCalls: 0,
      hiddenCalibrationAuthoring: 0,
      independentAdmissionResults: 0,
      humanEvaluationSubmissions: 0,
      previewChanges: 0,
      productionChanges: 0,
    },
    fingerprints: {
      pack: packFingerprint,
      goldMappingSource: validation.sourceFingerprints.goldMapping,
      blindPackageSource: validation.sourceFingerprints.blindPackage,
    },
    nextStop: "wait_for_product_owner_to_export_14_card_decisions",
  };
  await writeFile(paths.publicReceipt, `${JSON.stringify(publicReceipt, null, 2)}\n`, "utf8");
  return { paths, validation, publicReceipt };
}

async function main() {
  const result = await buildStageC3GoldReview();
  process.stdout.write(
    `GI088_STAGE_C3_GOLD_REVIEW_READY ${JSON.stringify({
      itemCount: result.validation.itemCount,
      composition: result.validation.composition,
      leaks: result.validation.sourceIdentifierLeaks,
      judgeCalls: result.validation.judgeModelCalls,
      packFingerprint: result.validation.packFingerprint,
      reviewFile: result.paths.privateHtml,
    })}\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `GI088_STAGE_C3_GOLD_REVIEW_FAILED:${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
