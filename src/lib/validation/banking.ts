import { z } from "zod";

/** Upper bound for transfers: matches `accounts.balance` NUMERIC(15,2) (Postgres max ~ 9999999999999.99). */
export const TRANSFER_AMOUNT_MAX = 9_999_999_999_999.99;

export const authLoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const authSignUpSchema = authLoginSchema.extend({
  fullName: z.string().trim().min(1).max(100),
});

export const newAccountSchema = z.object({
  accountName: z.string().trim().min(1).max(100),
  accountType: z.enum(["checking", "savings", "business"]),
});

export const transferFormSchema = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().positive().max(TRANSFER_AMOUNT_MAX),
    description: z.string().max(200).optional(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: "Source and destination must differ",
    path: ["toAccountId"],
  });

/** Matches server `normalize_recipient_account_number`: 16 digits (spaces / non-digits stripped). */
export const recipientAccountNumberSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .length(16, "Enter all 16 digits")
      .regex(/^[0-9]{16}$/, "Account number must be 16 digits")
  );

export const transferToSomeoneSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountNumber: recipientAccountNumberSchema,
  amount: z.number().positive().max(TRANSFER_AMOUNT_MAX),
  description: z.string().max(200).optional(),
});
