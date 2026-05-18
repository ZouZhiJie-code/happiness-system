import React from "react";
import { render } from "@testing-library/react";

import { authLocalUserIdStorageKey } from "@/features/auth/auth-local";
import { AuthLocalBootstrap } from "@/components/auth/auth-local-bootstrap";

describe("auth local bootstrap", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores the authenticated user id in local storage", () => {
    render(<AuthLocalBootstrap userId="user-1" />);

    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBe("user-1");
  });

  it("clears the local auth user id when no authenticated user is present", () => {
    window.localStorage.setItem(authLocalUserIdStorageKey, "user-1");

    render(<AuthLocalBootstrap userId={null} />);

    expect(window.localStorage.getItem(authLocalUserIdStorageKey)).toBeNull();
  });
});
