# Data boundary

`synthetic/` 및 `generated-dev-pack/`은 DEMO ONLY다. 공식 임상 데이터가 아니며 clinical production activation이 금지된다.

이 저장소 또는 배포 artifact에 넣지 않는 데이터:

- raw patient audio, raw transcript, 환자 식별정보
- 원본 공공 API source dump
- 약국 POS 원본 파일과 개별 거래 상세
- signing private key, API credential, 실제 `.env`
- 계약상 재배포가 허용되지 않은 provider payload

허용되는 산출물은 source snapshot의 hash/provenance, 검토된 정규화 엔터티, 비식별 90일 집계, synthetic fixture, mock HTTP response다. tenant POS adapter는 환자명·전화·주소 등 식별 열을 거부한다.

Production activation에는 승인된 official-source adapter, 기록된 이용조건, immutable locator, 현재 verification/expiry, 약사 승인, publisher 분리, 활성 `pack_id`, tenant isolation, external private signing key가 필요하다. source 권한이 `unknown` 또는 `contract_required`이면 production pack compile을 중단한다.
