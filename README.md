# PharmAssist Realtime Copilot

약국 상담 보조용 Windows 로컬 데모입니다. 합성 데이터 기반이며 임상 사용을 위한 검증 제품이 아닙니다.

## 다운로드·실행

**[최신 Windows 배포판 다운로드](https://github.com/yeohj0710/pharmassist-realtime-copilot/releases/latest/download/PharmAssist-Windows.zip)**

ZIP 압축을 푼 뒤 `PharmAssist.exe`를 실행합니다. 브라우저가 열리면 화면은 누구나 볼 수 있지만 상담·음성 기능은 비밀번호 `0903` 입력 후 사용할 수 있습니다.

## 웹 데모

**https://pharmassist-realtime-copilot.vercel.app**

Windows 프로그램과 같은 소스에서 빌드되는 정적 웹 데모입니다. 상담 판단 엔진과 후보 데이터 팩이 브라우저 안에서 그대로 동작합니다. AI 문장 보정·음성 인식은 로컬 API가 필요하므로 Windows 프로그램에서만 활성화됩니다.

웹 데모 배포는 `app` 디렉터리에서 실행합니다.

```powershell
corepack pnpm deploy:web
```

## 접속 주소

- 웹 데모: https://pharmassist-realtime-copilot.vercel.app
- 로컬 상담 화면: `http://127.0.0.1:4173`
- GitHub 저장소: https://github.com/yeohj0710/pharmassist-realtime-copilot
- 최신 배포판: https://github.com/yeohj0710/pharmassist-realtime-copilot/releases/latest

## 음성 입력

`말하기`를 한 번 누르고 말한 뒤 다시 눌러 종료합니다. 최초 한 번만 브라우저 마이크 권한을 허용합니다. 음성은 OpenAI Realtime transcription으로 텍스트 변환되며 로컬 데모에 저장하지 않습니다.

## API 비용

기본 상담은 저렴한 `gpt-5-nano`를 사용합니다. 직전 대화가 없으면 뜻이 성립하지 않는 짧은 답변은 `gpt-4.1-mini`로 자동 상향해 문맥을 해석합니다. API 키는 `.env`에만 저장되며 Git에 포함되지 않습니다.

## 개발 실행

```powershell
Set-Location app
Copy-Item .env.example .env
corepack pnpm install --frozen-lockfile
corepack pnpm dev:demo
```

## 검증

```powershell
corepack pnpm check
corepack pnpm test:e2e
```

프로덕션 임상 사용 전에는 공식 의약품 데이터, 약사 검수, 개인정보·법률·규제 검토가 별도로 필요합니다.
