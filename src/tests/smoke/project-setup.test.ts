import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import path from "path";

/**
 * Smoke tests: verify project instruction files exist in the repository.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */
describe("Project instruction files exist", () => {
  const root = path.resolve(__dirname, "../../../");

  it("CLAUDE.md exists at repository root (Requirement 8.1)", () => {
    expect(existsSync(path.join(root, "CLAUDE.md"))).toBe(true);
  });

  it("CLAUDE.local.md exists at repository root (Requirement 8.2)", () => {
    expect(existsSync(path.join(root, "CLAUDE.local.md"))).toBe(true);
  });

  it(".claude/rules/architecture-state.md exists (Requirement 8.3)", () => {
    expect(existsSync(path.join(root, ".claude/rules/architecture-state.md"))).toBe(true);
  });

  it(".claude/rules/code-style.md exists (Requirement 8.4)", () => {
    expect(existsSync(path.join(root, ".claude/rules/code-style.md"))).toBe(true);
  });

  it(".claude/rules/workflows-standards.md exists (Requirement 8.5)", () => {
    expect(existsSync(path.join(root, ".claude/rules/workflows-standards.md"))).toBe(true);
  });

  it("task.md exists at repository root (Requirement 8.6)", () => {
    expect(existsSync(path.join(root, "task.md"))).toBe(true);
  });

  it("SKILLS_MASTER.md exists at repository root (Requirement 8.7)", () => {
    expect(existsSync(path.join(root, "SKILLS_MASTER.md"))).toBe(true);
  });
});
