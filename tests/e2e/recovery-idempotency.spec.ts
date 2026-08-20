import { expect, test } from "@playwright/test";

import { E2E_ACCOUNTS } from "./support/accounts";
import { registerAccount } from "./support/auth";
import { shanghaiEntryDate } from "./support/date";
import { getE2EDatabase } from "./support/database";
import {
  exitRequest,
  postWorkspaceStream,
  readWorkspace,
  replyRequest,
  reserveTurn,
  startWorkspace
} from "./support/event-centered";

test.describe.configure({ mode: "serial" });

test("可靠保存后恢复沿用同一 clientTurnId", async ({ page }) => {
  await registerAccount(page, E2E_ACCOUNTS.recovery);
  const entryDate = shanghaiEntryDate();
  const started = await startWorkspace(page, {
    entryDate,
    recordMode: "chat",
    operationId: "recovery-start"
  });
  const clientTurnId = "recovery-turn-fixed";
  const rawText = "这段话先可靠保存，然后模拟网络中断。";
  const reserved = await reserveTurn(page, { workspace: started, clientTurnId, rawText });
  const database = getE2EDatabase();
  await database.interviewUserTurn.updateMany({
    where: { id: reserved.turn.id, status: "processing" },
    data: { status: "failed", errorCode: "REQUEST_CANCELED" }
  });

  await page.goto(`/interview?mode=event-centered&entryDate=${entryDate}&sessionId=${started.rootSessionId}`);
  await expect(page.getByText("这段话已保存，回复还没完成")).toBeVisible();
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/interview/event-centered/session/respond/stream") &&
    response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "继续生成" }).click();
  const resumedResponse = await responsePromise;
  expect(resumedResponse.status()).toBe(200);
  expect(await resumedResponse.finished()).toBeNull();
  const resumedRequest = resumedResponse.request();
  expect(resumedRequest.postDataJSON()).toMatchObject({ clientTurnId, action: "resume_turn" });
  await expect(page.getByText("这段话已保存，回复还没完成")).toBeHidden();
  await expect(page.getByTestId("event-centered-message-track")).toContainText(rawText);

  await expect.poll(async () => (await database.interviewUserTurn.findUnique({
    where: { sessionId_clientTurnId: { sessionId: started.activeBranchSessionId, clientTurnId } },
    select: { status: true }
  }))?.status).toBe("completed");
  const turns = await database.interviewUserTurn.findMany({
    where: { sessionId: started.activeBranchSessionId, clientTurnId },
    include: { messages: { where: { role: "user" } } }
  });
  expect(turns).toHaveLength(1);
  expect(turns[0]?.status).toBe("completed");
  expect(turns[0]?.messages).toHaveLength(1);
});

test("重复回复、旧页面和并发完成只保留一个有效结果", async ({ page }) => {
  await registerAccount(page, E2E_ACCOUNTS.idempotency);
  const entryDate = shanghaiEntryDate();
  const started = await startWorkspace(page, {
    entryDate,
    recordMode: "capture",
    operationId: "idempotency-start"
  });
  const duplicated = replyRequest(started, "same-client-turn", "同一次点击只应该保存一次。");
  const [first, second] = await Promise.all([
    postWorkspaceStream(page, duplicated),
    postWorkspaceStream(page, duplicated)
  ]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);

  const database = getE2EDatabase();
  expect(await database.interviewUserTurn.count({
    where: { sessionId: started.activeBranchSessionId, clientTurnId: "same-client-turn" }
  })).toBe(1);

  const stale = replyRequest(started, "stale-client-turn", "旧页面不应覆盖新状态。");
  const staleResponse = await postWorkspaceStream(page, stale);
  expect(staleResponse.status).toBe(200);
  expect(staleResponse.text).toContain("event: error");
  expect(staleResponse.text).toMatch(/INTERVIEW_TURN_OUT_OF_DATE|EVENT_STATE_CHANGED/u);
  expect(staleResponse.text).toContain("requestId");

  const latest = await readWorkspace(page, started.rootSessionId);
  const exit = exitRequest(latest, "same-exit-turn");
  const [completedA, completedB] = await Promise.all([
    postWorkspaceStream(page, exit),
    postWorkspaceStream(page, exit)
  ]);
  expect(completedA.status).toBe(200);
  expect(completedB.status).toBe(200);
  await expect.poll(async () => (await readWorkspace(page, started.rootSessionId)).sessionStatus)
    .toBe("completed");

  const user = await database.user.findUniqueOrThrow({ where: { username: E2E_ACCOUNTS.idempotency.username } });
  expect(await database.journalEventEntry.count({
    where: { event: { userId: user.id }, status: "saved" }
  })).toBe(1);
});
