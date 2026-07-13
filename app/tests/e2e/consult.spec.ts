import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("비밀번호").fill("0903");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByLabel("증상이나 질문을 입력하세요")).toBeVisible();
});

test("keyboard-only local consult and disclosure", async ({ page }) => {
  const serviceWorker = await page.request.get("/sw.js");
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain("index.html");
  await expect(
    page.getByText("합성 데이터 데모 · 임상 사용 금지"),
  ).toBeVisible();
  await page.keyboard.press("/");
  await page.keyboard.type("기침이 3일째예요");
  await page.keyboard.press("Enter");
  await expect(page.getByText("지금 말할 내용")).toBeVisible();
  await page.getByText("근거·주의사항").click();
  await expect(page.getByText(/공식 임상 출처 검토는 미완료/)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
test("offline badge does not hide local capability", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(page.getByText("오프라인 · 로컬 사용 가능")).toBeVisible();
  await context.setOffline(false);
});
test("critical result cannot be cleared before acknowledgement", async ({
  page,
}) => {
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
  await expect(
    page.getByRole("heading", { name: "약국 상담 도우미" }),
  ).toBeVisible();
});

test("short second answer completes a routine consult", async ({ page }) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("기침이 나요");
  await input.press("Enter");
  await expect(page.getByText("입력을 확인하고 있어요")).toBeVisible();
  await expect(
    page.getByRole("article").getByText("기침은 언제부터 시작됐나요?"),
  ).toBeVisible();
  await input.fill("어제부터요");
  await input.press("Enter");
  await expect(
    page.getByLabel("OTC 결정 결과").getByText("참고 추천", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("OTC 결정 결과").getByText("상담 결과"),
  ).toBeVisible();
  await expect(
    page.getByRole("article").getByText("기침은 언제부터 시작됐나요?"),
  ).toHaveCount(0);
});

test("abdominal pain never routes to the throat card", async ({ page }) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("배가 아파요");
  await input.press("Enter");
  await expect(
    page.getByRole("article").getByText(/윗배·아랫배 중 어디가/),
  ).toBeVisible();
  await expect(page.getByText(/목 통증은 언제부터/)).toHaveCount(0);
  await expect(page.getByText(/삼키기 어렵거나/)).toHaveCount(0);
});

test("an uncertain answer switches questions and still reaches guidance", async ({
  page,
}) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("배아파요");
  await input.press("Enter");
  await expect(page.getByText(/윗배·아랫배/).first()).toBeVisible();
  await input.fill("잘 모르겠어요");
  await input.press("Enter");
  await expect(page.getByText(/쥐어짜는 통증/).first()).toBeVisible();
  await input.fill("쓰리고 더부룩해요");
  await input.press("Enter");
  await expect(page.getByText(/속쓰림과 더부룩함/).first()).toBeVisible();
  await input.fill("속쓰림이 더 불편해요");
  await input.press("Enter");
  await expect(page.getByText("참고 추천", { exact: true })).toBeVisible();
  await expect(page.getByText("우선 검토할 성분군")).toBeVisible();
});

test("two uncertain answers still show practical symptom relief options", async ({
  page,
}) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("배아파요");
  await input.press("Enter");
  await input.fill("잘 모르겠어요");
  await input.press("Enter");
  await input.fill("잘 모르겠어요");
  await input.press("Enter");

  await expect(page.getByText("참고 추천", { exact: true })).toBeVisible();
  await expect(page.getByText(/알마게이트 또는 탄산칼슘/)).toBeVisible();
  await expect(page.getByText(/시메티콘/)).toBeVisible();
});

test("dyspepsia answers connect to named ingredients", async ({ page }) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("배아파요");
  await input.press("Enter");
  await input.fill("속이 안 좋아요 그냥");
  await input.press("Enter");
  await input.fill("토할 것 같아요 살짝");
  await input.press("Enter");

  await expect(
    page.getByText("속쓰림·소화불량 상담 경로", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/알마게이트 또는 탄산칼슘/)).toBeVisible();
  await expect(page.getByText(/시메티콘/)).toBeVisible();
  await expect(page.getByText(/판크레아틴/)).toBeVisible();
});

test("bowel urgency progresses without a prepared exact phrase", async ({
  page,
}) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("똥이 마려워요");
  await input.press("Enter");
  await expect(
    page.getByRole("article").getByText(/묽은 변.*변이 .*안 나오는/),
  ).toBeVisible();
  await input.fill("3분 전부터요");
  await input.press("Enter");
  await expect(
    page.getByLabel("OTC 결정 결과").getByText("상담 결과"),
  ).toBeVisible();
});

test("shoulder pain never routes to abdominal pain", async ({ page }) => {
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("어깨가 아파요");
  await input.press("Enter");
  await expect(page.getByText(/다치거나 붓고 뜨거운/).first()).toBeVisible();
  await expect(page.getByText(/윗배·아랫배/)).toHaveCount(0);
});

test("shows the new local answer immediately while AI refines it", async ({
  page,
}) => {
  let refinementCount = 0;
  await page.route("**/v1/consult/refine", async (route) => {
    refinementCount += 1;
    if (refinementCount === 2)
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: refinement.rejected\ndata: {"code":"TEST","fallback":"instant"}\n\n',
    });
  });
  const input = page.getByLabel("증상이나 질문을 입력하세요");
  await input.fill("기침이 나요");
  await input.press("Enter");
  await expect(
    page.getByRole("article").getByText("기침은 언제부터 시작됐나요?"),
  ).toBeVisible();
  await input.fill("어제부터요");
  await input.press("Enter");
  await expect(
    page.getByLabel("OTC 결정 결과").getByText("참고 추천", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".primary-guidance")).not.toContainText(
    "기침은 언제부터 시작됐나요?",
  );
});
