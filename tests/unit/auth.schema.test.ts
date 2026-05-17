import {
  deleteAccountRequestSchema,
  loginRequestSchema,
  registerRequestSchema
} from "@/features/auth/auth.schema";

describe("auth schema", () => {
  it("accepts a valid registration payload", () => {
    expect(() =>
      registerRequestSchema.parse({
        username: "daily_light_01",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).not.toThrow();

    expect(() =>
      registerRequestSchema.parse({
        username: "邹志杰_01",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).not.toThrow();
  });

  it("rejects usernames that are too short or contain invalid characters", () => {
    expect(() =>
      registerRequestSchema.parse({
        username: "ab",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).toThrow();

    expect(() =>
      registerRequestSchema.parse({
        username: "daily-light",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).toThrow();
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(() =>
      registerRequestSchema.parse({
        username: "daily_light_01",
        password: "short7",
        acceptedTerms: true,
        acceptedPrivacy: true
      })
    ).toThrow();
  });

  it("rejects registration when agreements are not accepted", () => {
    expect(() =>
      registerRequestSchema.parse({
        username: "daily_light_01",
        password: "supersecret1",
        acceptedTerms: false,
        acceptedPrivacy: true
      })
    ).toThrow();

    expect(() =>
      registerRequestSchema.parse({
        username: "daily_light_01",
        password: "supersecret1",
        acceptedTerms: true,
        acceptedPrivacy: false
      })
    ).toThrow();
  });

  it("accepts a valid login payload", () => {
    expect(() =>
      loginRequestSchema.parse({
        username: "daily_light_01",
        password: "supersecret1"
      })
    ).not.toThrow();
  });

  it("accepts a valid delete-account payload", () => {
    expect(() =>
      deleteAccountRequestSchema.parse({
        password: "supersecret1"
      })
    ).not.toThrow();
  });
});
