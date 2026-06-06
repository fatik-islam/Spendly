import { z } from "zod"

import {
  ACCOUNT_TYPES,
  CATEGORY_TYPES,
  CATEGORY_COLOR_PALETTE,
  CURRENCY_OPTIONS,
  RECURRING_FREQUENCIES,
  TRANSACTION_TYPES
} from "@/lib/constants"

const amountSchema = z.coerce.number().positive("Amount must be greater than zero.")
const dateSchema = z
  .string()
  .min(1, "Choose a date.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date.")

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Account name must be at least 2 characters."),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.coerce.number(),
  currency: z.enum(CURRENCY_OPTIONS)
})

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Category name must be at least 2 characters."),
  type: z.enum(CATEGORY_TYPES),
  color: z
    .string()
    .min(4)
    .refine((value) => CATEGORY_COLOR_PALETTE.includes(value as (typeof CATEGORY_COLOR_PALETTE)[number]), {
      message: "Choose a supported category color."
    }),
  icon: z.string().min(2)
})

export const transactionSchema = z
  .object({
    id: z.string().uuid().optional(),
    accountId: z.string().uuid("Choose an account."),
    transferAccountId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    type: z.enum(TRANSACTION_TYPES),
    amount: amountSchema,
    description: z.string().min(2, "Description must be at least 2 characters."),
    notes: z.string().max(500, "Notes are limited to 500 characters.").optional().nullable(),
    transactionDate: dateSchema,
    isRecurring: z.boolean().default(false)
  })
  .superRefine((value, context) => {
    if (value.type === "transfer") {
      if (!value.transferAccountId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "Choose the destination account."
        })
      }

      if (value.transferAccountId === value.accountId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transferAccountId"],
          message: "Transfer destination must be different from the source account."
        })
      }
    } else if (!value.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Choose a category."
      })
    }
  })

export const budgetSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid("Choose a category."),
  amount: amountSchema,
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2024).max(2100)
})

export const savingsGoalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Goal name must be at least 2 characters."),
  targetAmount: amountSchema,
  currentAmount: z.coerce.number().min(0),
  deadline: z.string().optional().nullable()
})

export const recurringTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid("Choose an account."),
  categoryId: z.string().uuid("Choose a category.").nullable().optional(),
  type: z.enum(["income", "expense"]),
  amount: amountSchema,
  description: z.string().min(2, "Description must be at least 2 characters."),
  frequency: z.enum(RECURRING_FREQUENCIES),
  nextDueDate: dateSchema,
  active: z.boolean().default(true)
})
