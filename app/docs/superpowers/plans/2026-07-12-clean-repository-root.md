# Clean Repository Root Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the GitHub and Windows repository root user-facing while preserving the executable monorepo under one configuration folder.

**Architecture:** Move all application source, workspace configuration, tests, specifications, and generated evidence into `프로그램 구성 파일`. Keep GitHub metadata at the repository root because Actions requires it there. Update the launcher, CI, release packaging, and documentation to treat the nested folder as the runtime working directory.

**Tech Stack:** PowerShell, C# launcher, pnpm/Turborepo, GitHub Actions

---

### Task 1: Move the monorepo

**Files:** Move all tracked development files except `.github`, `.gitignore`, `README.md`, and `PharmAssist.exe` into `프로그램 구성 파일`.

- [ ] Move tracked files with history-preserving `git mv` operations.
- [ ] Move local `.env` and runtime logs without exposing credentials.
- [ ] Remove generated root clutter that can be recreated.

### Task 2: Repair runtime and automation paths

**Files:**

- Modify: `프로그램 구성 파일/scripts/PharmAssistLauncher.cs`
- Modify: `프로그램 구성 파일/scripts/build-windows-launcher.ps1`
- Modify: `.github/workflows/*.yml`
- Modify: `프로그램 구성 파일/scripts/package-windows-release.ps1`

- [ ] Make the root EXE launch `프로그램 구성 파일/scripts/run-pharmassist.ps1`.
- [ ] Run CI commands from `프로그램 구성 파일`.
- [ ] Package the same clean root structure in GitHub Releases.

### Task 3: Verify and publish

- [ ] Run typecheck, tests, build, documentation checks, and release packaging.
- [ ] Launch the root EXE and verify ports 4173 and 8080.
- [ ] Commit, push `main`, tag the next release, and verify the download URL.
