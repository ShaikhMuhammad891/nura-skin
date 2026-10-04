import "@testing-library/jest-dom/vitest";

// Quiet, deterministic logs in tests.
process.env.LOG_LEVEL ??= "silent";
