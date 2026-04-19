import Link from "next/link";

const methodSteps = [
  {
    index: "01",
    title: "先把画面带回来",
    description: "像跟朋友复盘一样，把谁在场、发生了什么、你当时的感觉慢慢讲出来。"
  },
  {
    index: "02",
    title: "再聊它为什么重要",
    description: "我会顺着那一刻继续问，陪你找到真正触动你、支撑你的那个点。"
  },
  {
    index: "03",
    title: "一起认出这份感受",
    description: "有时候是被理解，有时候是终于放松，也可能只是你重新看见了那一刻的自己。"
  },
  {
    index: "04",
    title: "最后帮你收成一页",
    description: "我先把内容理成草稿，再交还给你，你想补、想改、想删都可以。"
  }
];

export default function HomePage() {
  return (
    <div className="space-y-4">
      <section className="page-shell min-h-[calc(100vh-8.25rem)] rounded-[42px] px-4 py-4 md:px-7 md:py-5">
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.16fr_0.84fr] lg:items-stretch">
          <div className="stagger-rise flex flex-col pt-4 pb-4 md:pt-6 md:pb-5 lg:pt-8 lg:pb-7">
            <h1 className="max-w-none font-display text-[3rem] leading-[1.04] tracking-[0.018em] text-[#2d2014] sm:text-[3.2rem] lg:text-[4.05rem] xl:text-[4.3rem]">
              <span className="block whitespace-nowrap">把今天的重要片段，</span>
              <span className="block text-[#5b5148]">整理成一份值得留下的日志记录。</span>
            </h1>
            <p className="mt-4 max-w-[52rem] text-[15px] leading-7 text-[#54402e] md:mt-5 md:text-[16px] md:leading-8">
              你带来一天里的真实片段，系统会用结构化访谈陪你慢慢梳理开心、充实、思考、改进与感谢，
              最后整理成一份清楚、可编辑、可确认的日志草稿。
            </p>
            <div className="mt-7 grid w-full max-w-[52rem] gap-4 sm:grid-cols-2">
              <Link
                href="/interview"
                className="flex min-h-[6rem] w-full items-center justify-center rounded-full border border-[rgba(115,74,37,0.24)] bg-[linear-gradient(180deg,#d8b17d,#c3925b)] px-10 py-5 text-center text-[22px] font-bold leading-none tracking-[0.01em] text-[#2f2823] shadow-[0_18px_34px_rgba(145,94,48,0.16),inset_0_1px_0_rgba(255,247,234,0.34)] transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb985,#c99862)] md:text-[23px]"
              >
                开始日志访谈
              </Link>
              <Link
                href="/settings"
                className="flex min-h-[6rem] w-full items-center justify-center rounded-full border border-[rgba(115,74,37,0.24)] bg-[linear-gradient(180deg,#d8b17d,#c3925b)] px-10 py-5 text-center text-[22px] font-bold leading-none tracking-[0.01em] text-[#2f2823] shadow-[0_18px_34px_rgba(145,94,48,0.16),inset_0_1px_0_rgba(255,247,234,0.34)] transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb985,#c99862)] md:text-[23px]"
              >
                查看记录设置
              </Link>
            </div>
          </div>

          <div className="paper-sheet ambient-float flex h-full flex-col rounded-[34px] p-4 md:p-5">
            <h2 className="font-display text-[2rem] leading-[0.98] text-[#241d16] md:text-[2.45rem]">可以这样聊</h2>
            <p className="mt-2 font-body text-[1.02rem] leading-[1.34] text-[#5d4d3f] md:text-[1.16rem]">
              你不用急着下结论，我们先把那一刻慢慢讲清楚。
            </p>
            <div className="mt-4 flex flex-1 flex-col justify-between">
              {methodSteps.map(({ index, title, description }, idx) => (
                <div
                  key={index}
                  className="grid min-h-[6.2rem] grid-cols-[1.95rem_1fr] items-start gap-1.5 rounded-[24px] border border-[rgba(123,82,42,0.14)] bg-[linear-gradient(180deg,rgba(255,250,243,0.92),rgba(245,229,201,0.9))] px-3 py-2.5 shadow-[0_12px_26px_rgba(126,87,47,0.1),inset_0_1px_0_rgba(255,255,255,0.52)] md:min-h-[6.35rem] md:grid-cols-[2.15rem_1fr] md:gap-2 md:px-4 md:py-3"
                  style={{ animationDelay: `${idx * 120}ms` }}
                >
                  <p className="pt-0.5 font-mono text-[1.16rem] tracking-[0.08em] text-[#a26c38] md:text-[1.24rem]">
                    {index}
                  </p>
                  <div className="flex h-full flex-col justify-center">
                    <p className="font-display text-[1.3rem] leading-none text-[#231c16] md:text-[1.36rem]">{title}</p>
                    <p className="mt-1 text-[0.88rem] leading-[1.4] text-[#5a4839] md:text-[0.93rem]">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
