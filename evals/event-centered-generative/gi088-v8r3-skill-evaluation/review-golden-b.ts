import { createHash } from "node:crypto";

import type { Gi088GoldenReviewItem } from "@/features/interview/event-centered/gi088-review-workbench";

type SourceCase = {
  id: string;
  workingTask: string;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  action: "ask" | "synthesize" | "acknowledge";
  understanding: string;
  response: string;
};

const sourceCases: SourceCase[] = [
  {
    id: "new-calibration-01",
    workingTask: "弄清准备充分后，汇报顺序仍会乱的触发点",
    conversation: [
      { role: "user", content: "我其实不在意他们怎么看。我想弄清楚的是，明明写了提纲，开口后为什么还是会把顺序讲乱。" }
    ],
    action: "ask",
    understanding: "你把重点纠正到了准备充分后仍会讲乱，评价顾虑先退出当前焦点。",
    response: "最近一次开始乱，是刚开口时，还是讲到某个具体部分之后？"
  },
  {
    id: "new-calibration-02",
    workingTask: "看清加班后刷手机的起点，并验证一个可执行调整",
    conversation: [
      { role: "user", content: "加班后脑子很累，不想再做选择，所以一拿手机就一直刷。我准备到家后把手机放客厅，洗澡后直接睡。继续。" }
    ],
    action: "synthesize",
    understanding: "你已经找到了刷下去的起点，也选了一个直接作用在起点上的调整。",
    response: "可以先把这条认识留下：加班后的决策疲劳和手机在手边一起拉长了刷屏，把手机放客厅正好减少这个入口。接下来几晚的实际变化还能继续校准它。"
  },
  {
    id: "new-calibration-03",
    workingTask: "区分室友忘记收碗的两种可观察原因",
    conversation: [
      { role: "user", content: "合租室友连续三次把洗好的碗留在沥水架。我提醒一次，他说晚点弄，后来还是没收。他为什么会这样？" }
    ],
    action: "ask",
    understanding: "目前能确认的是他多次把碗留在沥水架，提醒后仍没收，具体原因还缺证据。",
    response: "可能是他容易忘，也可能是他认为放在沥水架已经算收好。你观察到他对别的家务也会答应后忘记，还是只在收碗这件事上这样？"
  },
  {
    id: "new-calibration-04",
    workingTask: "弄清拒绝临时需求时真正担心失去什么",
    conversation: [
      { role: "user", content: "同事又在下班前塞给我一个临时需求。我其实可以拒绝，可每次话到嘴边就变成‘我尽量’。" },
      { role: "assistant", content: "你已经看到自己有拒绝空间，但表达时仍会往承担上走。" },
      { role: "user", content: "对，我怕拒绝后他以后也不愿意帮我。" }
    ],
    action: "ask",
    understanding: "你担心的代价已经从一次临时需求变成了以后互相帮助的关系。",
    response: "最近一次他帮到你的具体事情是什么？那次帮助和你是否接下这个临时需求之间，有没有说过明确的交换条件？"
  },
  {
    id: "new-calibration-05",
    workingTask: "理解周末无法休息的持续牵挂",
    conversation: [
      { role: "user", content: "周末明明没工作，我还是一直想着下周的汇报。" },
      { role: "assistant", content: "身体停下来了，注意力还留在汇报上。最容易反复想到的是哪一部分？" },
      { role: "user", content: "就是开头怎么讲，我总觉得一开口就会乱。" }
    ],
    action: "ask",
    understanding: "让你难以休息的焦点已经收到了汇报开头，以及对开口后失序的担心。",
    response: "你现在最拿不准的是开头第一句话，还是第一句话之后怎样接到主体？"
  },
  {
    id: "new-calibration-06",
    workingTask: "确认一次边界表达已经获得了什么新证据",
    conversation: [
      { role: "user", content: "我终于跟朋友说今晚想一个人待着。她只回了句好，并没有像我想的那样生气。" }
    ],
    action: "synthesize",
    understanding: "这次直接表达边界后，关系没有出现你预想的冲突。",
    response: "这次经历给了你一条可以继续验证的新证据：说出想独处，并不必然等于拒绝关系，对方也可能直接接住。"
  },
  {
    id: "new-calibration-07",
    workingTask: "承接用户对同一件事同时存在的两种感受",
    conversation: [
      { role: "user", content: "拿到 offer 我很开心，但也确实舍不得现在的团队。这两个感觉就是一起的。" }
    ],
    action: "acknowledge",
    understanding: "开心和舍不得同时存在，它们分别连着新机会和当前关系。",
    response: "这两种感受可以一起留下，它们没有互相抵消，也暂时不需要被压成一个结论。"
  },
  {
    id: "new-calibration-08",
    workingTask: "找到拖延回复消息时负担最大的环节",
    conversation: [
      { role: "user", content: "有些消息我一看就想晚点回，结果拖好几天。" },
      { role: "assistant", content: "你想弄清楚这种拖延从哪里开始。最近一条被你放了几天的消息是什么类型？" },
      { role: "user", content: "朋友问我周末要不要见面，我当时还不确定安排。" }
    ],
    action: "ask",
    understanding: "这次拖延发生在你还不能确定周末安排、又觉得需要给出明确答复的时候。",
    response: "如果只回复‘我还没确定，明晚告诉你’，对你来说最难的地方会是什么？"
  },
  {
    id: "new-calibration-09",
    workingTask: "在用户明确停止时如实收住当前认识",
    conversation: [
      { role: "user", content: "我现在知道自己介意的是他说好后又临时改变，而且没有告诉我。今天先聊到这里。" }
    ],
    action: "synthesize",
    understanding: "你已经确认自己介意的是约定被改变时缺少说明。",
    response: "先把这条认识留在这里：变化本身可以商量，真正影响你的是约定改变时没有被提前告知。今天就停在这里。"
  },
  {
    id: "new-calibration-10",
    workingTask: "把抽象的自我怀疑落到一个最近发生的片段",
    conversation: [
      { role: "user", content: "我总觉得自己是不是太敏感了。" },
      { role: "assistant", content: "你想判断自己的反应是否超过了事情本身。最近哪件事让你冒出这个怀疑？" },
      { role: "user", content: "昨天同事没回我的方案，只在群里回复了另一个人。" }
    ],
    action: "ask",
    understanding: "这个怀疑落到了同事跳过你的方案、转而回复别人这一刻。",
    response: "当时最先让你觉得被忽略的，是他没有回应方案内容，还是他在同一时间回应了别人？"
  },
  {
    id: "new-calibration-11",
    workingTask: "理解用户为何觉得奶奶的干涉让自己窒息",
    conversation: [
      { role: "user", content: "她总刷到一些危言耸听的视频，然后拿来管我。我已经说了很多次，这让我觉得被忽视和被干涉。" }
    ],
    action: "ask",
    understanding: "你已经明确表达了被忽视和被干涉。",
    response: "你觉得她为什么还要这样干涉你？"
  },
  {
    id: "new-calibration-12",
    workingTask: "弄清项目被改动时用户真正介意的部分",
    conversation: [
      { role: "user", content: "我能接受方案变动，我介意的是他没商量就替我改了。" }
    ],
    action: "ask",
    understanding: "你担心方案改动后会不会失败。",
    response: "最近一次让你害怕方案失败是什么时候？"
  },
  {
    id: "new-calibration-13",
    workingTask: "理解一次公开发言后持续复盘的原因",
    conversation: [
      { role: "user", content: "会上我把一个数字说错了，后来已经更正，但回家后还在反复想。" },
      { role: "assistant", content: "数字已经更正，脑子却还停在那个失误上。你最担心别人因此怎么看你？" },
      { role: "user", content: "我担心他们觉得我准备不充分。" }
    ],
    action: "ask",
    understanding: "你担心大家会觉得你准备不充分。",
    response: "这种担心让你心里是什么感觉？"
  },
  {
    id: "new-calibration-14",
    workingTask: "看清休息时仍感到内疚的触发条件",
    conversation: [
      { role: "user", content: "我一休息就内疚，觉得别人都在进步。" }
    ],
    action: "ask",
    understanding: "你把休息和落后联系在了一起。",
    response: "你平时为什么会这么想？这和你的成长经历有什么关系？如果不休息又会怎样？"
  },
  {
    id: "new-calibration-15",
    workingTask: "判断一次请求是否值得接受",
    conversation: [
      { role: "user", content: "领导让我临时接一个活，我不知道该不该答应。" },
      { role: "assistant", content: "你想看清接受和拒绝各自会影响什么。现在已知的时间要求是什么？" },
      { role: "user", content: "他只说尽快，也没说具体截止。" }
    ],
    action: "ask",
    understanding: "领导希望你尽快完成，但截止时间还不明确。",
    response: "你觉得领导为什么故意不说截止时间？"
  },
  {
    id: "new-calibration-16",
    workingTask: "理解朋友迟到为何持续影响用户",
    conversation: [
      { role: "user", content: "朋友迟到一小时，我最介意的是她中间一直没告诉我还要多久。" }
    ],
    action: "ask",
    understanding: "你在意的是等待过程里缺少信息。",
    response: "她迟到一小时的时候，你是不是觉得很生气？"
  },
  {
    id: "new-calibration-17",
    workingTask: "承接用户已经形成的行动决定",
    conversation: [
      { role: "user", content: "我已经决定明天跟他说明，改时间可以，但要先问我。" }
    ],
    action: "ask",
    understanding: "你已经决定表达自己的边界。",
    response: "那你准备什么时候说？打算用什么语气？如果他反驳你怎么办？"
  },
  {
    id: "new-calibration-18",
    workingTask: "弄清工作交接反复出错的具体断点",
    conversation: [
      { role: "user", content: "每次交接都出问题，我怀疑我们根本不适合合作。" },
      { role: "assistant", content: "你想从最近一次交接看清问题发生在哪里。那次遗漏了什么？" },
      { role: "user", content: "我漏说了客户周五不在，他也没看日历。" }
    ],
    action: "ask",
    understanding: "那次问题同时包含你漏说客户安排，以及对方没有查看共享日历。",
    response: "你们合作多久了？以前也一直这样吗？"
  },
  {
    id: "new-calibration-19",
    workingTask: "确认用户对一次失败反馈的真实反应",
    conversation: [
      { role: "user", content: "老师说我这版结构还不清楚。我知道要改哪里，也已经列了三步。" }
    ],
    action: "ask",
    understanding: "你已经知道修改方向，也拆出了三步。",
    response: "听到老师说不清楚时，你是不是还是挺挫败的？"
  },
  {
    id: "new-calibration-20",
    workingTask: "在材料不足时帮助用户理解伴侣沉默的原因",
    conversation: [
      { role: "user", content: "我问伴侣周末去哪，他看了消息没回。他到底什么意思？" }
    ],
    action: "synthesize",
    understanding: "他看了消息没有回复，说明他对周末安排没有兴趣。",
    response: "他可能已经不想和你安排周末，只是还没直接说出来。"
  }
];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createGi088V8r3GoldenBItems(): Gi088GoldenReviewItem[] {
  return sourceCases.map((item) => {
    const checkpoints = [
      {
        visibleConversation: item.conversation,
        candidateVisibleOutput: {
          action: item.action,
          understanding: item.understanding,
          response: item.response
        },
        safeTrace: {
          latencyMs: null,
          automaticRecoveryCount: 0,
          contractValid: true,
          technicalFailure: false
        }
      }
    ];
    return {
      sampleId: sha256(`gi088-v8r3-golden-b:${item.id}`).slice(0, 20),
      sourcePartition: "golden_calibration",
      contentFingerprint: sha256(JSON.stringify({ checkpoints })),
      workingTask: item.workingTask,
      checkpoints
    };
  });
}
