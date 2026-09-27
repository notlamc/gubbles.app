import { z } from "zod";
import { AUTH } from "@/lib/game/constants";

/** Shared input schemas: used by API route handlers (authoritative) and forms (convenience). */

export const normalizeEmail = (v: string) => v.normalize("NFKC").trim().toLowerCase();
export const normalizeUsername = (v: string) => v.normalize("NFKC").trim().toLowerCase();
/** Strip common formatting characters; the result must be E.164. */
export const normalizePhone = (v: string) => v.normalize("NFKC").replace(/[\s().-]/g, "");

export const EmailSchema = z
  .string()
  .max(254)
  .transform(normalizeEmail)
  .pipe(z.email({ message: "Enter a valid email address." }));

export const UsernameSchema = z
  .string()
  .transform((v) => v.normalize("NFKC").trim())
  .pipe(
    z
      .string()
      .regex(/^[A-Za-z0-9_]{3,20}$/, "Usernames are 3–20 letters, numbers or underscores."),
  );

export const PhoneSchema = z
  .string()
  .max(32)
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Use international format with country code, e.g. +447700900123."));

export const PasswordSchema = z
  .string()
  .min(AUTH.PASSWORD_MIN, `Passwords need at least ${AUTH.PASSWORD_MIN} characters.`)
  .max(AUTH.PASSWORD_MAX, `Passwords can be at most ${AUTH.PASSWORD_MAX} characters.`);

export const DisplayNameSchema = z
  .string()
  .transform((v) => v.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Pick a display name.").max(40, "Display names are at most 40 characters."))
  .refine((v) => !/[<>\u0000-\u001f]/.test(v), "Display names can't contain those characters.");

export const PublicHandleSchema = z
  .string()
  .transform((v) => v.normalize("NFKC").trim())
  .pipe(z.string().regex(/^[A-Za-z0-9_]{3,20}$/, "Handles are 3–20 letters, numbers or underscores."));

export const CodeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Codes are 6 digits."));

export const RecoveryCodeSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[a-z0-9]{10}$/, "Recovery codes look like abcde-12345."));

export const SignupSchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  phone: PhoneSchema,
  password: PasswordSchema,
  acceptTerms: z.literal(true, { message: "Please accept the terms to continue." }),
});

export const SigninSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username.").max(254),
  password: z.string().min(1, "Enter your password.").max(AUTH.PASSWORD_MAX),
});

export const MfaSchema = z.union([
  z.object({ code: CodeSchema }),
  z.object({ recoveryCode: RecoveryCodeSchema }),
]);
