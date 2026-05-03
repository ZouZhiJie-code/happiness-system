"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

import {
  interviewDimensionStorageKey,
  normalizeInterviewDimension
} from "@/features/interview/dimensions";
import type { InterviewDimension } from "@/types/interview";

interface StartInterviewLinkProps {
  className?: string;
  children?: ReactNode;
}

export function StartInterviewLink({ className, children = "开始今天的记录" }: StartInterviewLinkProps) {
  const [dimension, setDimension] = useState<InterviewDimension>("joy");

  useEffect(() => {
    const remembered = normalizeInterviewDimension(window.localStorage.getItem(interviewDimensionStorageKey));
    setDimension(remembered);
  }, []);

  return (
    <Link
      href={`/interview?dimension=${dimension}`}
      className={twMerge(
        clsx(
          "flex min-h-[3.2rem] w-full items-center justify-center rounded-full border border-[rgba(115,74,37,0.22)] bg-[#3a2a1e] px-8 py-3 text-center text-[15px] font-medium leading-none text-[#f8f0e4] shadow-[0_8px_20px_rgba(58,42,30,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2d2014] hover:shadow-[0_12px_28px_rgba(58,42,30,0.2)] sm:min-h-[3.5rem] sm:text-[16px]",
          className
        )
      )}
    >
      {children}
    </Link>
  );
}
