import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  AUTH_USERNAME_MAX_LENGTH,
  AUTH_USERNAME_MIN_LENGTH
} from "@/features/auth/auth.constants";
import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(AUTH_USERNAME_MIN_LENGTH)
  .max(AUTH_USERNAME_MAX_LENGTH)
  .regex(/^[\p{Script=Han}A-Za-z0-9_]+$/u);

export const passwordSchema = z.string().min(AUTH_PASSWORD_MIN_LENGTH).max(AUTH_PASSWORD_MAX_LENGTH);

const acceptedAgreementSchema = z.literal(true);

export const registerRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  acceptedTerms: acceptedAgreementSchema,
  acceptedPrivacy: acceptedAgreementSchema
});

export const loginRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema
});

export const deleteAccountRequestSchema = z.object({
  password: passwordSchema
});

export const authSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      id: z.string(),
      username: z.string()
    })
    .nullable()
});
