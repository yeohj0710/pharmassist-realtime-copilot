# PharmAssist Windows

## 실행

1. 압축을 완전히 풉니다.
2. `PharmAssist.exe`를 더블클릭합니다.
3. 브라우저가 열릴 때까지 기다립니다. 첫 실행은 필요한 구성요소 설치로 시간이 조금 걸릴 수 있습니다.

검은 로그 창은 표시되지 않습니다. 실행 중 EXE를 다시 누르면 기존 서버를 재사용해 브라우저만 엽니다.

## OpenAI 연결

API 키 없이도 합성 데이터 기반 로컬 데모가 동작합니다. AI 보정을 켜려면 PowerShell에서 다음 파일을 실행하고 본인의 API 키를 입력합니다.

```powershell
powershell -ExecutionPolicy Bypass -File "app\scripts\set-openai-key.ps1"
```

키는 `app\.env`에만 저장되며 배포 파일이나 GitHub에 포함되지 않습니다.

## 문제 확인

`app\logs\pharmassist.log`를 확인합니다.

현재 배포본은 합성 데이터 데모이며 임상 사용용 제품이 아닙니다.
