import { z } from "zod";

const baseDatabaseFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(255, "Display name is too long"),
  description: z.string().max(2000, "Description is too long"),
  engine: z.literal("postgres"),
  recoveryMode: z.enum(["direct", "aws-rds"]),
  host: z.string().trim().max(255, "Host is too long"),
  port: z.coerce
    .number({ invalid_type_error: "Port must be a number" })
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
  databaseName: z.string().trim().max(255, "Database name is too long"),
  username: z.string().trim().max(255, "Username is too long"),
  password: z.string().max(512, "Password is too long"),
  sslMode: z.enum(["require", "prefer", "disable"]),
  region: z.string().max(50, "Region is too long"),
  rdsSourceIdentifier: z.string().max(255, "RDS instance ID is too long"),
  recoveryUseFreetier: z.boolean(),
  recoverySandboxInstanceClass: z.string().max(50, "Instance class is too long"),
  awsAccessKeyId: z.string().max(128, "Access key is too long"),
  awsSecretAccessKey: z.string().max(128, "Secret key is too long"),
});

function refineRecoveryMode(
  data: z.infer<typeof baseDatabaseFields>,
  ctx: z.RefinementCtx,
  requireAwsKeys: boolean
) {
  if (data.recoveryMode === "direct") {
    if (!data.host.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host is required for direct connection",
        path: ["host"],
      });
    }
    if (!data.databaseName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Database name is required",
        path: ["databaseName"],
      });
    }
    if (!data.username.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Username is required",
        path: ["username"],
      });
    }
    return;
  }

  if (!data.rdsSourceIdentifier.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RDS instance identifier is required (e.g. database-1)",
      path: ["rdsSourceIdentifier"],
    });
  }
  if (!data.region.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "AWS region is required",
      path: ["region"],
    });
  }
  if (!data.username.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RDS master username is required",
      path: ["username"],
    });
  }
  if (!data.databaseName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Database name inside RDS is required",
      path: ["databaseName"],
    });
  }

  const hasNewAws =
    data.awsAccessKeyId.trim().length > 0 || data.awsSecretAccessKey.trim().length > 0;

  if (requireAwsKeys || hasNewAws) {
    if (!data.awsAccessKeyId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: requireAwsKeys
          ? "AWS access key ID is required"
          : "Provide both access key ID and secret when rotating AWS keys",
        path: ["awsAccessKeyId"],
      });
    }
    if (!data.awsSecretAccessKey.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: requireAwsKeys
          ? "AWS secret access key is required"
          : "Provide both access key ID and secret when rotating AWS keys",
        path: ["awsSecretAccessKey"],
      });
    }
  }
}

/** Create wizard — AWS keys required when mode is aws-rds */
export const databaseWizardSchema = baseDatabaseFields.superRefine((data, ctx) => {
  refineRecoveryMode(data, ctx, data.recoveryMode === "aws-rds");
  if (data.recoveryMode === "aws-rds" && !data.password.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RDS master password is required",
      path: ["password"],
    });
  }
});

/** Edit form — AWS keys optional when already stored (validated in page if missing) */
export const databaseEditSchema = baseDatabaseFields.superRefine((data, ctx) => {
  refineRecoveryMode(data, ctx, false);
});

export type DatabaseWizardValues = z.infer<typeof databaseWizardSchema>;

export const wizardDefaults: DatabaseWizardValues = {
  name: "",
  description: "",
  engine: "postgres",
  recoveryMode: "direct",
  host: "",
  port: 5432,
  databaseName: "",
  username: "",
  password: "",
  sslMode: "require",
  region: "",
  rdsSourceIdentifier: "",
  recoveryUseFreetier: true,
  recoverySandboxInstanceClass: "",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
};

export const stepFields: Record<1 | 2 | 3 | 4, (keyof DatabaseWizardValues)[]> = {
  1: ["name", "description", "region", "recoveryMode"],
  2: [
    "host",
    "port",
    "databaseName",
    "username",
    "password",
    "sslMode",
    "rdsSourceIdentifier",
    "recoveryUseFreetier",
    "recoverySandboxInstanceClass",
    "awsAccessKeyId",
    "awsSecretAccessKey",
  ],
  3: [],
  4: [],
};
