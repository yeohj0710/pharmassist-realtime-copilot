import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("비밀번호").fill("0903");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(
    page.getByLabel("손님이 말한 증상이나 질문을 입력하세요"),
  ).toBeVisible();
});

test("keyboard-only local consult and disclosure", async ({ page }) => {
  const serviceWorker = await page.request.get("/sw.js");
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain("index.html");
  await expect(
    page.getByText("공식 조사 후보 데이터 · 약사 검토 전"),
  ).toBeVisible();
  await page.keyboard.press("/");
  await page.keyboard.type("기침이 3일째예요");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/손님에게 이렇게 (물어|말해)보세요/u),
  ).toBeVisible();
  await page.getByText("근거·주의사항").click();
  await expect(page.getByText(/약사 검토와 운영.*미완료/)).toBeVisible();
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

test("a greeting gets a conversational reply without becoming a patient fact", async ({
  page,
}) => {
  await page.route("**/v1/consult/interpret", (route) => route.abort());
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("어이");
  await input.press("Enter");
  await expect(
    page.getByText("네, 말씀하세요. 증상이나 찾는 약을 편하게 말씀해 주세요."),
  ).toBeVisible();
  await expect(page.getByText("근거 부족", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0개 확인", { exact: true })).toBeVisible();
});

test("escape does not clear an active consultation", async ({ page }) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("기침나요");
  await input.press("Enter");
  await expect(
    page
      .getByText(/마른기침에 가깝나요, 가래가 나오는 기침에 가깝나요/)
      .first(),
  ).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(
    page
      .getByText(/마른기침에 가깝나요, 가래가 나오는 기침에 가깝나요/)
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "새 상담" })).toBeVisible();
  await expect(
    page.locator(".latest-customer-message").getByText("기침나요", {
      exact: true,
    }),
  ).toBeVisible();
});

test("critical result cannot be cleared before acknowledgement", async ({
  page,
}) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
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
  await expect(page.getByRole("button", { name: "새 상담" })).toBeVisible();
  await expect(
    page
      .locator(".latest-customer-message")
      .getByText("숨이 안 쉬어져요", { exact: true }),
  ).toBeVisible();
});

test("generic abdominal pain waits for the phenotype before showing a product", async ({
  page,
}) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("배아프노");
  await input.press("Enter");
  await expect(
    page.getByText(/속쓰림·신물, 멀미 뒤 메스꺼움, 설사/u).first(),
  ).toBeVisible();
  await expect(page.getByText(/대표 제품은 한 가지/u)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "현재 무난한 후보" }),
  ).toHaveCount(0);
  await expect(page.getByText("보나링츄어블정", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".candidate-sidebar .sidebar-product")).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "식약처 품목정보" })).toHaveCount(
    0,
  );
  await expect(page.getByText(/^DEC-/)).toHaveCount(0);

  await input.fill("속쓰림도 있어요");
  await input.press("Enter");
  // The answer supersedes the abdominal triage question, so the candidates
  // panel (provisional or confirmed) appears without repeating it.
  await expect(
    page.getByRole("heading", { name: /현재 (?:무난한|제품) 후보/u }),
  ).toBeVisible();
  await expect(
    page.getByText("겔포스엠", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/속쓰림·신물, 멀미 뒤 메스꺼움, 설사/u),
  ).toHaveCount(0);
});

test("actual dry-cough protocol is selected without abdominal leakage", async ({
  page,
}) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("마른기침이 나요");
  await input.press("Enter");
  await expect(page.getByText(/복통·구토/)).toHaveCount(0);
  // Age/pregnancy is never interrogated up front, so the pattern already
  // named in the first turn completes the consult immediately.
  await expect(page.locator(".primary-guidance")).not.toContainText("임신");
  await expect(
    page
      .locator(".result .ingredient-summary")
      .getByText("덱스트로메토르판브롬화수소산염수화물", {
        exact: true,
      }),
  ).toBeVisible();
  const coughProduct = page
    .locator(".result .product-card")
    .filter({ hasText: "해소코푸에스시럽" });
  await expect(coughProduct).toBeVisible();
  const combinationSummary = page.locator(".result .combination-summary");
  await expect(
    combinationSummary.getByText("함께 검토할 조합", { exact: true }),
  ).toBeVisible();
  await expect(
    combinationSummary.getByText("쎄파렉신연조엑스", { exact: true }),
  ).toBeVisible();
  const spokenGuidance = page.locator(".primary-guidance .say").first();
  await expect(spokenGuidance).toContainText("후보로 볼게요");
  await expect(spokenGuidance).not.toContainText(
    /상황으로 보입니다|현재 증상에 연결된|근거가 연결된|고려해볼 수 있습니다|판단됩니다/u,
  );
  await expect(
    page.getByText("지금 말씀해 주신 증상에 맞춰 살펴볼 제품이에요.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("그날엔콜드연질캡슐", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("그날엔콜드에이연질캡슐", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "식약처 품목정보" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "약학정보원" }).first(),
  ).toBeVisible();
  await expect(
    coughProduct.locator('[data-official-match-status="confirmed"]'),
  ).toHaveText("약학정보원 공식 연결");
  // The price shows as a bare figure: no snapshot label, no recorded date.
  await expect(
    coughProduct.getByText("2,500원", { exact: true }),
  ).toBeVisible();
  await expect(
    coughProduct.getByText("가격 스냅샷", { exact: true }),
  ).toHaveCount(0);
  await expect(coughProduct.getByText(/기록/u)).toHaveCount(0);
  // The product name itself links to the official 약학정보원 page.
  await expect(
    coughProduct.getByRole("link", { name: "해소코푸에스시럽" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/(?:www\.)?health\.kr\/searchDrug\/result_drug\.asp\?drug_cd=2019012500051$/u,
  );
  await expect(coughProduct.getByText("6P", { exact: true })).toBeVisible();
  await expect(coughProduct.getByText(/지엘파마/u)).toBeVisible();
  await expect(
    coughProduct.getByText("시럽제 · 경구(내용액제)", { exact: true }),
  ).toBeVisible();
  await expect(
    coughProduct.getByText("주요 적응증", { exact: true }),
  ).toBeVisible();
  await expect(coughProduct.getByText("용법", { exact: true })).toBeVisible();
  // The card stays scannable: no long precaution block and a single official
  // source link; full text lives behind the 약학정보원 link.
  await expect(
    coughProduct.getByText("핵심 주의", { exact: true }),
  ).toHaveCount(0);
  await expect(
    coughProduct.getByText("기침, 가래", { exact: true }),
  ).toBeVisible();
  await expect(
    coughProduct.getByRole("link", { name: "약학정보원 공식 정보" }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/(?:www\.)?health\.kr\/searchDrug\/result_drug\.asp\?drug_cd=2019012500051$/u,
  );
  await expect(
    coughProduct.getByRole("link", { name: "제품 이미지 출처" }),
  ).toHaveCount(0);

  await page.getByText("근거·주의사항", { exact: true }).click();
  const supportingDetails = page.locator(".supporting-content");
  await expect(supportingDetails.locator("code")).toHaveCount(0);
  await expect(supportingDetails).not.toContainText(
    /CLM-|SNAP-|REG-|source_snapshot_id|locator/u,
  );
});

test("generic cough shows a current product, asks one pattern question, and keeps layout stable", async ({
  page,
}) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("기침나요");
  await input.press("Enter");
  await expect(
    page
      .getByText(/마른기침에 가깝나요, 가래가 나오는 기침에 가깝나요/)
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "현재 제품 후보" }),
  ).toBeVisible();
  const queryPanelBox = await page.locator(".query-panel").boundingBox();
  expect(queryPanelBox).not.toBeNull();
  const viewportWidth = page.viewportSize()!.width;
  expect(
    Math.abs(queryPanelBox!.x + queryPanelBox!.width / 2 - viewportWidth / 2),
  ).toBeLessThan(2);
  await expect(page.locator(".candidate-sidebar .sidebar-product")).toHaveCount(
    1,
  );
  await expect(
    page
      .locator(".candidate-sidebar")
      .getByText("해소코푸에스시럽", { exact: true })
      .first(),
  ).toBeVisible();
  // The sidebar pages through every current candidate instead of pinning one.
  const sidebarNav = page.locator(".sidebar-candidate-nav");
  await expect(sidebarNav.locator("span")).toHaveText(/^1\/[2-9]$/u);
  await sidebarNav.getByRole("button", { name: "다음 후보" }).click();
  await expect(sidebarNav.locator("span")).toHaveText(/^2\/[2-9]$/u);
  await expect(
    page
      .locator(".candidate-sidebar")
      .getByText("쎄파렉신연조엑스", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.locator(".candidate-sidebar .sidebar-product")).toHaveCount(
    1,
  );
  await sidebarNav.getByRole("button", { name: "이전 후보" }).click();
  await expect(
    page
      .locator(".candidate-sidebar")
      .getByText("해소코푸에스시럽", { exact: true })
      .first(),
  ).toBeVisible();

  const loadingPosition = await page.evaluate(() => {
    const status = document.createElement("div");
    status.className = "engine-status";
    document.body.append(status);
    const position = getComputedStyle(status).position;
    status.remove();
    return position;
  });
  expect(loadingPosition).toBe("fixed");

  await input.fill("마른기침이고 임신은 아니에요");
  await input.press("Enter");
  await expect(
    page
      .locator(".result .product-card")
      .filter({ hasText: "해소코푸에스시럽" }),
  ).toBeVisible();
  const coughProduct = page
    .locator(".result .product-card")
    .filter({ hasText: "해소코푸에스시럽" });
  await expect(
    coughProduct.getByText("우선 후보", { exact: true }),
  ).toBeVisible();
  await expect(
    coughProduct.getByText("덱스트로메토르판브롬화수소산염수화물", {
      exact: true,
    }),
  ).toBeVisible();
});

test("a new symptom keeps earlier topic candidates in the same patient consultation", async ({
  page,
}) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("35살이고 임신은 아니고 알레르기 비염이 있어요");
  await input.press("Enter");
  await expect(page.getByText(/^(현재 후보|검증된 후보)$/u)).toBeVisible();

  await input.fill("그리고 기침도 나요");
  await input.press("Enter");
  await expect(
    page
      .getByText(/마른기침에 가깝나요, 가래가 나오는 기침에 가깝나요/)
      .first(),
  ).toBeVisible();
  await expect(
    page.locator(".candidate-sidebar .sidebar-candidate-topic"),
  ).toHaveCount(2);
  await expect(
    page
      .locator(".candidate-sidebar")
      .getByText("시노타딘", { exact: true })
      .first(),
  ).toBeVisible();

  await input.fill("마른기침이에요");
  await input.press("Enter");
  await expect(
    page
      .locator(".result .ingredient-summary")
      .getByText("덱스트로메토르판브롬화수소산염수화물", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    page
      .locator(".result .product-card")
      .filter({ hasText: "해소코푸에스시럽" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "함께 확인 중인 증상" }),
  ).toBeVisible();
  await expect(page.getByText(/마른기침 · 알레르기비염/u)).toBeVisible();
});

test("sore throat and heartburn remain separate while one useful question leads", async ({
  page,
}) => {
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("목이 아파요");
  await input.press("Enter");
  await expect(page.getByText(/삼키기 힘들 정도/u).first()).toBeVisible();
  await expect(
    page
      .locator(".candidate-sidebar")
      .getByText("스트렙실허니앤레몬트로키(플루르비프로펜)", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(page.getByText("아세트아미노펜", { exact: true })).toHaveCount(
    0,
  );

  await input.fill("그리고 속쓰림이 있어요");
  await input.press("Enter");

  const provisionalTopics = page.locator(
    ".candidate-sidebar .sidebar-candidate-topic",
  );
  await expect(provisionalTopics).toHaveCount(2);
  await expect(
    provisionalTopics.getByText("속쓰림", { exact: true }),
  ).toBeVisible();
  await expect(
    provisionalTopics.getByText("인후통", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/삼키기 힘들 정도/u).first()).toBeVisible();
  await expect(page.locator(".result .product-candidates")).toHaveCount(0);
});

test("shows the new local answer immediately while AI refines it", async ({
  page,
}) => {
  await page.route("**/v1/consult/interpret", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        disposition: "clinical_intent",
        intent: "abdominal_pain_unknown",
        confidence: 0.95,
        topic_changed: false,
      }),
    });
  });
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
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("배아파요");
  await input.press("Enter");
  await expect(input).toBeEnabled();
  await expect(
    page.getByText(/속쓰림·신물, 멀미 뒤 메스꺼움, 설사/u).first(),
  ).toBeVisible({ timeout: 1_000 });
});

test("keeps the customer's joint site while AI supplies only an intent hint", async ({
  page,
}) => {
  await page.route("**/v1/consult/interpret", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        disposition: "clinical_intent",
        intent: "musculoskeletal_pain",
        confidence: 0.96,
        topic_changed: false,
      }),
    });
  });
  const input = page.getByLabel("손님이 말한 증상이나 질문을 입력하세요");
  await input.fill("35살이고 임신은 아니고 무릎이 아파요");
  await input.press("Enter");

  await expect(page.getByText("손님이 한 말", { exact: true })).toBeVisible();
  await expect(
    page
      .locator(".latest-customer-message")
      .getByText("35살이고 임신은 아니고 무릎이 아파요", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".candidate-sidebar .sidebar-product").first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".candidate-sidebar")
      .getByText("파인큐이부펜시럽", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("아세트아미노펜", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByText("무릎은 움직일 때 더 아픈가요, 가만히 있어도 계속 아픈가요?")
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(/어깨를 움직일 때|어깨는 움직일 때/u),
  ).toHaveCount(0);

  await input.fill("움직일 때 더 아파요");
  await input.press("Enter");

  const ez6 = page
    .locator(".product-candidates > article")
    .filter({ hasText: "이지엔6애니연질캡슐" });
  await expect(ez6.locator("img")).toBeVisible();
  await expect(ez6.getByRole("link", { name: "약학정보원" })).toHaveAttribute(
    "href",
    "https://www.health.kr/searchDrug/result_drug.asp?drug_cd=A11APPPPP2807",
  );
});
