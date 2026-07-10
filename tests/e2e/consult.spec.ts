import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("keyboard-only local consult and disclosure", async ({ page }) => {
  await page.goto("/");
  const serviceWorker = await page.request.get("/sw.js");
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain("index.html");
  await expect(
    page.getByText("합성 데이터 데모 · 임상 사용 금지"),
  ).toBeVisible();
  await page.keyboard.press("/");
  await page.keyboard.type("기침이 3일째예요");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "지금 말할 내용" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /출처·버전/ }).click();
  await expect(page.getByText(/공식 임상 출처 검토는 미완료/)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
test("offline badge does not hide local capability", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await context.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(page.getByText("오프라인 · 로컬 사용 가능")).toBeVisible();
  await context.setOffline(false);
});
test("critical result cannot be cleared before acknowledgement", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("숨이 안 쉬어져요");
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "먼저 위험 신호를 확인하세요" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "먼저 위험 신호를 확인하세요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /확인했습니다/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "빠른 시작" })).toBeVisible();
});
