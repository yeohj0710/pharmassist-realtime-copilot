import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
const stages = ["Source", "Claim", "Card", "Conflict", "Review", "Pack"];
function Reviewer() {
  const [stage, setStage] = useState(0);
  const [role, setRole] = useState("reviewer");
  return (
    <main>
      <aside>
        <h1>PharmAssist</h1>
        <p>검토 콘솔 · 합성 데이터</p>
        {stages.map((s, i) => (
          <button
            className={stage === i ? "active" : ""}
            onClick={() => setStage(i)}
            key={s}
          >
            {i + 1}. {s}
          </button>
        ))}
      </aside>
      <section>
        <header>
          <div>
            <small>테넌트: demo-tenant</small>
            <h2>{stages[stage]} 검토</h2>
          </div>
          <select
            aria-label="역할"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="reviewer">reviewer</option>
            <option value="publisher">publisher</option>
          </select>
        </header>
        <div className="warning">
          합성 fixture 전용 · 공식 출처와 면허자 승인이 없으면 게시 불가
        </div>
        <article>
          <div>
            <span className="tag">Tier B 후보</span>
            <h3>SYN-CLAIM-{stage + 1}</h3>
            <p>
              출처 locator, 관할, 대상군, 제형, 검증일, 만료일을 확인하세요.
            </p>
          </div>
          <dl>
            <dt>상태</dt>
            <dd>검토 대기</dd>
            <dt>출처 locator</dt>
            <dd>synthetic://fixture/{stage + 1}</dd>
            <dt>충돌</dt>
            <dd>{stage === 3 ? "미해결 — 게시 차단" : "없음"}</dd>
            <dt>이중 승인</dt>
            <dd>0 / 2</dd>
          </dl>
        </article>
        <div className="actions">
          <button disabled={role !== "reviewer"}>검토 의견 기록</button>
          <button
            className="publish"
            disabled={role !== "publisher" || stage === 3}
          >
            게시 승인
          </button>
        </div>
        <p className="audit">
          모든 변경은 reason code와 content-free audit event를 요구합니다.
          reviewer와 publisher 역할은 분리됩니다.
        </p>
      </section>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing root");
createRoot(root).render(
  <StrictMode>
    <Reviewer />
  </StrictMode>,
);
