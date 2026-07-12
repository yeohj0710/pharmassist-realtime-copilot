# Conversation Memory And Patient Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep multi-turn consultations coherent and show a continuously accumulated patient summary.

**Architecture:** Store role-labelled patient and assistant turns in volatile browser memory, send the latest 12 turns to refinement, and derive a compact patient summary from all patient turns. Reset both transcript and summary only when “새 상담” is selected.

**Tech Stack:** React, TypeScript, JSON Schema, Vitest

---

### Task 1: Conversation memory

- [ ] Add role-labelled transcript helpers with replacement of provisional assistant output.
- [ ] Send patient questions and assistant prompts together to the API.
- [ ] Expand the refinement contract from 6 to 12 turns.

### Task 2: Patient summary

- [ ] Accumulate unique patient statements, symptom keywords, duration, and risk statements.
- [ ] Render a restrained summary panel beside the active response.
- [ ] Clear summary and transcript on a new consultation.

### Task 3: Verification

- [ ] Add regression tests for 8+ turns and assistant-question context.
- [ ] Run full checks and browser verification.
- [ ] Rebuild the launcher, package, push, and publish a new Windows release.
