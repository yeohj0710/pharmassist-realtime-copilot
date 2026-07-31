import { describe, expect, it } from "vitest";
import {
  book1SourceSnapshot,
  bookLocator,
  corpusDigest,
  corpusPageIndex,
  parseBookLocator,
  parseChapter,
} from "./book1-bogyak.js";

const chapter = {
  fileName: "40_칼슘제.md",
  text: [
    "---",
    "book: book1-bogyak",
    "title: 약사들의 친절한 복약 안내서",
    "chapter: 칼슘제는 골다공증에 필수인가요?",
    "pages: 147-148",
    "---",
    "<!-- p0147 -->",
    "## 칼슘제",
    "성인 권장량은 1,000~1,300mg입니다.",
    "<!-- p0148 -->",
    "비타민D는 800단위 이상 함께 먹습니다.",
    "",
  ].join("\n"),
};

describe("reading the book by page", () => {
  it("splits a chapter at its printed page anchors", () => {
    const parsed = parseChapter(chapter);

    expect(parsed.frontMatter.chapter).toBe("칼슘제는 골다공증에 필수인가요?");
    expect(parsed.pages.map((page) => page.page)).toEqual([147, 148]);
    expect(parsed.pages[0]?.text).toContain("1,000~1,300mg");
    // The anchor comment itself is not part of what the page says.
    expect(parsed.pages[0]?.text).not.toContain("<!--");
    expect(parsed.pages[1]?.text).toBe("비타민D는 800단위 이상 함께 먹습니다.");
  });

  it("round-trips a locator a reviewer can follow", () => {
    const locator = bookLocator("40_칼슘제.md", 147);

    expect(locator).toBe("book1-bogyak/40_칼슘제.md#p0147");
    expect(parseBookLocator(locator)).toEqual({
      fileName: "40_칼슘제.md",
      page: 147,
    });
    expect(parseBookLocator("book1-bogyak/40_칼슘제.md")).toBeNull();
    expect(parseBookLocator("other-book/x.md#p0147")).toBeNull();
  });

  it("indexes only pages the corpus actually carries", () => {
    const index = corpusPageIndex([parseChapter(chapter)]);

    expect(index.get("40_칼슘제.md")?.has(147)).toBe(true);
    expect(index.get("40_칼슘제.md")?.has(149)).toBe(false);
  });
});

describe("the digest that pins the corpus", () => {
  it("ignores file order and newline style", () => {
    const a = { fileName: "a.md", text: "첫째\n둘째\n" };
    const b = { fileName: "b.md", text: "셋째\n" };

    expect(corpusDigest([a, b])).toBe(corpusDigest([b, a]));
    expect(corpusDigest([{ ...a, text: "첫째\r\n둘째\r\n" }, b])).toBe(
      corpusDigest([a, b]),
    );
  });

  it("notices a rename that leaves the text alone", () => {
    const original = [{ fileName: "a.md", text: "같은 본문" }];
    const renamed = [{ fileName: "b.md", text: "같은 본문" }];

    expect(corpusDigest(original)).not.toBe(corpusDigest(renamed));
  });
});

describe("the source record for the book", () => {
  const snapshot = book1SourceSnapshot("a".repeat(64), {
    records: 410,
    pages: 301,
  });

  it("does not claim regulatory authority", () => {
    // A pharmacist-authored book is expert opinion, not a marketing
    // authorisation, and must never be cited as one.
    expect(snapshot["official"]).toBe(false);
    expect(snapshot["source_id"]).toBe("SRC-BOOK1-BOGYAK");
  });

  it("leaves every reuse right unconfirmed", () => {
    // Nobody has checked what the publisher permits, so nothing may read as
    // permission. These stay unknown until a person confirms otherwise.
    for (const field of [
      "usage_rights",
      "commercial_use",
      "cache_policy",
      "redistribution",
      "ai_context_use",
    ])
      expect(snapshot[field]).toBe("unknown");
    expect(snapshot["terms_url"]).toBeNull();
  });

  it("says in its own note that nothing was fetched over HTTP", () => {
    expect(String(snapshot["uncertainty"])).toContain("실제 요청은 없었다");
    expect(String(snapshot["uncertainty"])).toContain("허가사항이 아니다");
  });
});
