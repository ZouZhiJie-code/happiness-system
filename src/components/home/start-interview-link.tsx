"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  interviewDimensionStorageKey,
  normalizeInterviewDimension
} from "@/features/interview/dimensions";
import type { InterviewDimension } from "@/types/interview";

export function StartInterviewLink() {
  const [dimension, setDimension] = useState<InterviewDimension>("joy");

  useEffect(() => {
    const remembered = normalizeInterviewDimension(window.localStorage.getItem(interviewDimensionStorageKey));
    setDimension(remembered);
  }, []);

  return (
    <Link
      href={`/interview?dimension=${dimension}`}
      className="flex min-h-[6rem] w-full items-center justify-center rounded-full border border-[rgba(115,74,37,0.24)] bg-[linear-gradient(180deg,#d8b17d,#c3925b)] px-10 py-5 text-center text-[22px] font-bold leading-none tracking-[0.01em] text-[#2f2823] shadow-[0_18px_34px_rgba(145,94,48,0.16),inset_0_1px_0_rgba(255,247,234,0.34)] transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb985,#c99862)] md:text-[23px]"
    >
      开始日志访谈
    </Link>
  );
}
