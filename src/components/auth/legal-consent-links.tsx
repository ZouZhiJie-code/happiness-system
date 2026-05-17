import React from "react";
import Link from "next/link";

export function LegalConsentLinks() {
  return (
    <p className="text-sm leading-7 text-ink/72">
      注册即表示你已阅读并同意
      <Link href="/legal/terms" className="mx-1 text-[#7a4f2e] underline decoration-[rgba(122,79,46,0.35)] underline-offset-4">
        《用户协议》
      </Link>
      和
      <Link href="/legal/privacy" className="mx-1 text-[#7a4f2e] underline decoration-[rgba(122,79,46,0.35)] underline-offset-4">
        《隐私政策》
      </Link>
      。
    </p>
  );
}

