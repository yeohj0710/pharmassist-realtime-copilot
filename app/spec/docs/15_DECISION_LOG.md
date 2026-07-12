# 15. Decision Log

## D-001 — Foundation model training 없음

**결정:** v1에서 자체 학습/파인튜닝하지 않는다.  
**이유:** 안전 사실을 가중치가 아니라 검증 가능한 claim/card에 두고, 구현·갱신 속도를 높인다.

## D-002 — First useful card를 1초 목표로 정의

**결정:** 완성 LLM 답변이 아닌 로컬 카드 SLA.  
**이유:** 네트워크와 음성 발화 자체는 통제 불가. 사용자가 필요한 것은 우선 한 문장이다.

## D-003 — 브라우저 Web Worker local engine

**결정:** first path를 서버가 아니라 client memory에서 실행.  
**이유:** 지연·오프라인·프라이버시 개선. 동일 core를 서버 재검증에도 공유.

## D-004 — OpenAI Realtime은 전사 중심

**결정:** 기본은 `gpt-realtime-whisper`; full voice agent 비활성.  
**이유:** 제품은 약사가 말하는 도구이며, direct AI voice가 필요하지 않고 통제·비용·복잡도를 늘린다.

## D-005 — Responses는 보정용

**결정:** exact/high confidence에는 호출하지 않음.  
**이유:** latency와 hallucination을 줄이고 local card가 source of truth가 되게 한다.

## D-006 — 원본 문서 runtime RAG 금지

**결정:** compile-time authoring only.  
**이유:** 자료의 신뢰도·권리·최신성·판촉 혼합을 런타임 모델이 안정적으로 해결할 수 없다.

## D-007 — 사람 OTC부터

**결정:** 기본 domain은 human OTC.  
**이유:** 처방/건기식/동물약은 규칙·검수·법적 범위가 다르며 혼합 위험이 크다.

## D-008 — 판매 최적화 배제

**결정:** 매출·마진·재고가 clinical rank를 바꾸지 않음.  
**이유:** 환자 안전과 약사의 전문 판단이 우선이다.

## D-009 — Push-to-talk

**결정:** silent always-on listening 기본 금지.  
**이유:** 약국 주변인의 민감정보 혼입과 법적·프라이버시 위험을 줄인다.

## D-010 — No raw logs

**결정:** audio/transcript/free-text 기본 저장 금지.  
**이유:** 운영 개선에 필요한 지표는 coded events로 충분하며 건강정보 노출을 최소화한다.

## D-011 — Strict schema everywhere

**결정:** JSON Schema를 Web/API/LLM/pack의 단일 계약으로 사용.  
**이유:** 임의 자연어 파싱과 schema drift를 차단한다.

## D-012 — Fail closed for high risk

**결정:** source 만료·충돌·필수 슬롯 누락 시 구체 안내를 차단.  
**이유:** 오래되거나 불완전한 정답보다 확인 질문/의뢰가 안전하다.
