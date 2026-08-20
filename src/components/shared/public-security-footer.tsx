import Image from "next/image";

const publicSecurityRecordCode = "36110302000181";
const publicSecurityRecordUrl = `https://beian.mps.gov.cn/#/query/webSearch?code=${publicSecurityRecordCode}`;
const icpRecordText = "赣ICP备2026003367号";
const icpRecordUrl = "https://beian.miit.gov.cn/";

export function PublicSecurityFooter() {
  return (
    <footer className="relative z-0 w-full border-t border-[var(--line-soft)] bg-[var(--color-workspace)] px-5 py-2 text-center text-[13px] leading-5 text-[var(--text-dim)] sm:px-8">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <a
          href={publicSecurityRecordUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`查询赣公网安备${publicSecurityRecordCode}号`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2 transition-colors hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-workspace)]"
        >
          <Image src="/brand/public-security-beian.png" alt="" width={18} height={20} className="h-5 w-[18px]" />
          <span>赣公网安备 {publicSecurityRecordCode} 号</span>
        </a>
        <a
          href={icpRecordUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`查询${icpRecordText}`}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-2 transition-colors hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-workspace)]"
        >
          {icpRecordText}
        </a>
      </div>
    </footer>
  );
}
