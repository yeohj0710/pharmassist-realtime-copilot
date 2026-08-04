# PharmAssist 작업 규칙

작업 규칙의 원본은 AGENTS.md다. 아래 import로 전문을 불러온다.

@AGENTS.md

가장 자주 깨지는 규칙이라 여기 한 번 더 적는다.

**사람이 검토해야 한다는 이유로 이미 구현한 기능을 지우거나 비활성화하거나 약하게 바꾸지 않는다.** 검토 대기는 상태 플래그일 뿐이다. 승인 플래그(verified, published, pharmacist_reviewed)를 임의로 올리는 것은 별개 문제이며 그대로 금지한다. 기능은 끝까지 구현하고 플래그만 false로 둔다.
