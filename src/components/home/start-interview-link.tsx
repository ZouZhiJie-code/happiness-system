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
      className="flex min-h-[5rem] w-full items-center justify-center border border-[rgba(115,74,37,0.24)] bg-[linear-gradient(180deg,#d8b17d,#c3925b)] px-8 py-4 text-center text-[20px] font-bold leading-none text-[#2f2823] shadow-[0_12px_24px_rgba(145,94,48,0.13),inset_0_1px_0_rgba(255,247,234,0.34)] transition duration-200 hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,#ddb985,#c99862)] md:text-[21px]"
    >
      开始日志访谈
    </Link>
  );
}
