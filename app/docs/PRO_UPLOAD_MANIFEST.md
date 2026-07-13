# PharmAssist Pro 업로드 묶음

웹 Pro는 로컬 파일에 접근하지 못한다. 이 묶음은 현재 프로젝트를 읽고 결과 파일을 만들 수 있도록 필요한 텍스트 소스와 요구사항을 한 ZIP에 담는다.

## ZIP 구성

- `00_START_HERE.txt`: 그대로 실행할 프롬프트
- `01_PROJECT_BRIEF.md`: 프로젝트·데이터·추천 구조 브리프
- `02_UPLOAD_MANIFEST.md`: 이 문서
- `FILE_LIST.txt`: 포함된 프로젝트 파일 목록
- `repository/`: 현재 작업 트리 스냅샷

## 포함

- 현재 Git tracked 파일의 최신 working-tree 내용
- TypeScript 앱·패키지·도구·테스트
- JSON Schema·migration·API 계약
- 프로젝트 사양·아키텍처·안전·지식 작성 문서
- `.env.example`과 설정 예시
- 이번 Pro 브리프·프롬프트

따라서 아직 commit되지 않은 소스 변경도 포함될 수 있다. Pro는 이를 이전 버전으로 되돌리면 안 된다.

## 제외

- `.git/`
- 실제 `.env`
- credential·API key·private key
- `node_modules/`, `dist/`, `.turbo/`
- report·coverage·Playwright 결과·로그
- 실행파일·ZIP·이미지·아이콘
- TypeScript build cache
- Codex 임시자료와 백업

공개키와 synthetic dev pack은 비밀정보가 아니며 현재 pack 구조를 보여주는 자료로 포함할 수 있다. signing private key는 포함하지 않는다.

## 결과 적용 방식

Pro는 로컬 저장소를 직접 바꿀 수 없다. `PharmAssist-Pro-Result.zip`을 반환하고, 그 안의 `changed-files/`가 `repository/` 기준 상대경로를 유지해야 한다. 이후 로컬 Codex가 변경 충돌을 검토하고 실제 저장소에 적용한 뒤 테스트한다.

## 생성 시점

- 기준일: 2026-07-13
- 프로젝트: PharmAssist Realtime Copilot
- 대상: 일반의약품 데이터·추천 구조 재설계
