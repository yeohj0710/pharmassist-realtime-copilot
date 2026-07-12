# Privacy and data flow

기본값은 “수집하지 않음”이다. raw audio, raw transcript, 자유서술 feedback, 환자 이름·전화·주소·주민번호·결제정보를 DB schema에 두지 않는다.

1. 브라우저 입력은 메모리와 Worker에서 처리한다.
2. PII detector가 phone/email/RRN/address/payment/possible name을 찾고 redact한다.
3. RRN·payment·불확실 name처럼 안전한 제거를 확신할 수 없으면 외부 refinement를 차단한다.
4. OpenAI 요청은 redacted text, allowlisted claim/entity, coded metadata만 포함하고 `store:false`다.
5. 로그는 event name, request ID, rule/card ID, latency bucket 같은 allowlisted metadata만 쓴다.
6. PTT 종료·상담 종료 시 MediaStream track과 buffer를 폐기한다.

개인정보 처리방침, 국외 이전, 보유기간, 동의 문구, OpenAI ZDR/MAM/계약 조건은 조직의 개인정보·법률 담당자가 확정해야 한다. 현재 문서는 법률 자문이 아니다.
