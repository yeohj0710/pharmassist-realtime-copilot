# 약사 실시간 복약상담 코파일럿 — 설계·구현 인계 패키지

이 패키지는 첨부된 약사 자료 124개를 파일별로 검토한 뒤 만든 **OpenAI API 래퍼 기반, 약사 전용 실시간 상담 보조 시스템**의 구현 명세다. 원본 자료나 장문의 원문은 포함하지 않았고, 출처 감사표·정책·스키마·프롬프트·테스트·Codex 구현 지시서만 포함한다.

## 먼저 읽을 파일

1. [`MASTER_HANDOFF.md`](MASTER_HANDOFF.md) — 전체 결론과 절대 제약
2. [`codex/MASTER_IMPLEMENTATION_PROMPT.md`](codex/MASTER_IMPLEMENTATION_PROMPT.md) — Codex/GPT-5.6에 그대로 전달할 구현 프롬프트
3. [`codex/ACCEPTANCE_CRITERIA.md`](codex/ACCEPTANCE_CRITERIA.md) — 완료 판정 기준
4. [`docs/03_SYSTEM_ARCHITECTURE.md`](docs/03_SYSTEM_ARCHITECTURE.md) — 전체 구조
5. [`docs/07_SAFETY_GUARDRAILS.md`](docs/07_SAFETY_GUARDRAILS.md) — 임상 안전 경계
6. [`SOURCE_AUDIT.csv`](SOURCE_AUDIT.csv) — 124개 파일별 사용/차단 판정

## 결론 한 줄

**매 입력마다 LLM이 처음부터 추론하게 만들지 않는다.** 약사가 승인한 상담카드를 브라우저 메모리에서 수십~수백 ms에 찾고, OpenAI Responses API는 필요할 때만 뒤에서 문장 다듬기·모호성 해소를 수행한다. 음성은 OpenAI Realtime transcription의 부분 전사를 같은 로컬 엔진에 흘려보낸다.

## 패키지 구조

```text
.
├── MASTER_HANDOFF.md
├── SOURCE_AUDIT.csv
├── SOURCE_AUDIT_SUMMARY.json
├── SOURCE_MANIFEST.csv
├── architecture/      # Mermaid 구성·시퀀스·상태·지식 생명주기
├── codex/             # 구현 에이전트용 단일 프롬프트와 완료 기준
├── config/            # 모델·출처·개인정보·지연시간·기능 플래그
├── docs/              # PRD, 아키텍처, 안전, API, 배포, 법률 메모
├── examples/          # 합성 예시. 생산 배포 금지
├── prompts/           # 런타임/오프라인 저작·검수 프롬프트
├── references/        # 공식 외부 참조 목록
├── repo_blueprint/    # 권장 리포지토리 트리와 환경·CI·배포 골격
└── schemas/           # JSON Schema 계약
```

## 중요한 제한

- 본 제품은 **약사-facing decision support**다. 환자에게 직접 진단·처방하거나 약사를 대체하지 않는다.
- 첨부 자료는 실무 아이디어와 표현의 후보일 뿐, 운영 임상 사실로 자동 승격하지 않는다.
- 소아 용량, 임부·수유, 금기, 상호작용, 복용 누락, 응급·의뢰 기준은 최신 공식 출처와 약사 검수 없이는 배포할 수 없다.
- 마이크는 기본 `push-to-talk`이며, 무음 상시청취는 기본적으로 금지한다.
- 음성·전사 원문은 기본 저장하지 않는다.
- `examples/`는 스키마 시연용 합성 자료다. 승인되지 않은 예시가 production knowledge pack에 들어가면 CI가 실패해야 한다.

## 추가 구현 자산

- [`START_HERE.md`](START_HERE.md) — 인계 순서
- [`docs/16_OPENAI_INTEGRATION_RECIPES.md`](docs/16_OPENAI_INTEGRATION_RECIPES.md) — Responses/WebRTC adapter recipe
- [`knowledge_seed/`](knowledge_seed/) — 73개 candidate intent, 219개 합성 alias, 31개 slot taxonomy
- [`tests/`](tests/) — 50개 adversarial case, privacy/security, latency benchmark spec
- [`repo_blueprint/`](repo_blueprint/) — 환경·Compose·CI·pack gate 골격

모든 seed/example은 임상 사용 금지이며, production profile에서는 자동 차단해야 한다.
