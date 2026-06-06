import { z } from "zod"

export const DEFAULT_PASSWORD_MIN_LENGTH = 6

const emailSchema = z.string().email("Enter a valid email address.")

function createPasswordSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return z.string().min(minLength, `Password must be at least ${minLength} characters.`)
}

export function createSignInSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return z.object({
    email: emailSchema,
    password: createPasswordSchema(minLength),
    rememberMe: z.boolean().default(false)
  })
}

export function createSignUpSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return createSignInSchema(minLength).extend({
    fullName: z.string().min(2, "Full name must be at least 2 characters.")
  })
}

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email.")
})

export const requestPasswordResetSchema = z.object({
  email: emailSchema
})

function createResetPasswordBaseSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return z.object({
    newPassword: createPasswordSchema(minLength),
    confirmPassword: z.string().min(1, "Confirm your new password.")
  })
}

export function createResetPasswordValuesSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return createResetPasswordBaseSchema(minLength).refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  })
}

export function createResetPasswordCodeSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return createResetPasswordBaseSchema(minLength)
    .extend({
      email: emailSchema,
      code: z
        .string()
        .regex(/^\d{6}$/, "Enter the 6-digit code from your email.")
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match."
    })
}

export function createResetPasswordTokenSchema(minLength = DEFAULT_PASSWORD_MIN_LENGTH) {
  return createResetPasswordBaseSchema(minLength)
    .extend({
      otp: z.string().min(1, "Missing reset token.")
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match."
    })
}

export const submitResetPasswordSchema = z
  .object({
    email: emailSchema.optional(),
    code: z
      .string()
      .regex(/^\d{6}$/, "Enter the 6-digit code from your email.")
      .optional(),
    otp: z.string().min(1, "Missing reset token.").optional(),
    newPassword: z.string().min(1, "Enter a new password.")
  })
  .refine((values) => Boolean(values.otp) || Boolean(values.email && values.code), {
    message: "Provide either a reset token or an email plus 6-digit code.",
    path: ["otp"]
  })
