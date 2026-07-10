# Intended use and limitations

의도된 사용은 면허 있는 약사의 상담 보조다. 환자에게 직접 진단하거나 처방을 변경하고, 제품·성분·용량을 임의로 확정하는 시스템이 아니다.

현재 가능한 것:

- 합성 한국어 fixture로 local normalization/safety/retrieval UI 검증
- 위험 신호 우선, blocking slot, numeric/product/domain gate 검증
- mock Responses와 fake Realtime reducer 검증
- signed synthetic pack lifecycle과 rollback 검증

현재 불가능한 것:

- 실제 환자 상담
- 공식 의약품·DUR·허가사항의 최신성 보장
- 임상 정확도·recall의 외부 인증
- 법률·개인정보·의료기기 규제 적합성 주장
- 실제 약국 소음·방언·고령층·제품명 음성 성능 보장

공식 data/license, 면허자 이중 승인, 보안·개인정보·규제 검토, OpenAI 조직 계약, target benchmark가 끝나기 전 clinical production release를 금지한다.
