import "@testing-library/jest-dom";

// Existing service suites exercise the released interview flow unless a case
// explicitly opts into shadow or enforce behavior.
process.env.INTERVIEW_CONTENT_UNDERSTANDING_MODE = "legacy";
