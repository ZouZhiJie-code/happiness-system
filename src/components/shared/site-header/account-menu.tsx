"use client";

import { Menu } from "@base-ui/react/menu";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppToast } from "@/components/ui/app-toast";
import {
  clearLocalAuthUserId,
  getLocalAuthUserId,
  getScopedLocalStorageKey
} from "@/features/auth/auth-local";
import {
  clearStoredInterviewSessionId,
  interviewDimensionStorageKey,
  interviewDimensions,
  interviewSessionFreshStartStorageKey,
  interviewSessionStorageKey
} from "@/features/interview/dimensions";
import { cn } from "@/lib/utils";

import {
  ChevronDownIcon,
  FileTextIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserRoundIcon
} from "./account-menu-icons";

function clearInterviewClientState() {
  const localAuthUserId = getLocalAuthUserId();
  interviewDimensions.forEach((dimension) => {
    clearStoredInterviewSessionId(dimension);
  });

  if (localAuthUserId) {
    window.localStorage.removeItem(getScopedLocalStorageKey(interviewSessionStorageKey, localAuthUserId));
    window.localStorage.removeItem(getScopedLocalStorageKey(interviewDimensionStorageKey, localAuthUserId));
    window.localStorage.removeItem(getScopedLocalStorageKey(interviewSessionFreshStartStorageKey, localAuthUserId));
  }

  clearLocalAuthUserId();
}

const ACCOUNT_ROUTES = ["/settings", "/legal/privacy", "/legal/terms"] as const;

export function AccountMenu({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = ACCOUNT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("退出失败，请稍后再试");

      clearInterviewClientState();
      router.replace("/");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "退出失败，请稍后再试");
      setLoggingOut(false);
    }
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          className={cn("ui-account-menu__trigger", active && "ui-account-menu__trigger--active")}
          aria-label={active ? "打开账户菜单，当前在账户页面" : "打开账户菜单"}
        >
          <UserRoundIcon className="size-5" />
          <span className="hidden text-[13px] font-semibold sm:inline">账户</span>
          <ChevronDownIcon className="size-4 opacity-65" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="ui-account-menu__positioner" sideOffset={8} align="end" collisionPadding={12}>
            <Menu.Popup className="ui-account-menu__popup" aria-label="账户菜单">
              <Menu.Group>
                <Menu.GroupLabel className="ui-account-menu__label">账户</Menu.GroupLabel>
                <Menu.LinkItem href="/settings" closeOnClick className="ui-account-menu__item">
                  <SettingsIcon className="size-5" />
                  <span>设置</span>
                </Menu.LinkItem>
                <Menu.LinkItem href="/legal/privacy" closeOnClick className="ui-account-menu__item">
                  <ShieldCheckIcon className="size-5" />
                  <span>隐私政策</span>
                </Menu.LinkItem>
                <Menu.LinkItem href="/legal/terms" closeOnClick className="ui-account-menu__item">
                  <FileTextIcon className="size-5" />
                  <span>用户协议</span>
                </Menu.LinkItem>
              </Menu.Group>
              <Menu.Separator className="ui-account-menu__separator" />
              <Menu.Item
                className="ui-account-menu__item ui-account-menu__item--danger"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
              >
                <LogOutIcon className="size-5" />
                <span>{loggingOut ? "正在退出" : "退出登录"}</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {error ? (
        <AppToast message={error} placement="below-header" testId="account-menu-error" />
      ) : null}
    </>
  );
}
