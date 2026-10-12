import { z } from "zod";

const baseDatabaseFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(255, "Display name is too long"),
  description: z.string().max(2000, "Description is too long"),
  engine: z.enum(["postgres", "mysql", "mongodb"]),
  recoveryMode: z.enum(["direct", "aws-rds"]),
  connectionString: z.string(),
  host: z.string().trim(),
  port: z.coerce.number(),
  databaseName: z.string().trim(),
  username: z.string().trim(),
  password: z.string(),
  sslMode: z.enum(["require", "prefer", "disable"]),
  region: z.string().max(50, "Region is too long"),
  rdsSourceIdentifier: z.string().max(255, "RDS instance ID is too long"),
  recoveryUseFreetier: z.boolean(),
  recoveryDrillsEnabled: z.boolean(),
  recoverySandboxInstanceClass: z.string().max(50, "Instance class is too long"),
  awsAccessKeyId: z.string().max(128, "Access key is too long"),
  awsSecretAccessKey: z.string().max(128, "Secret key is too long"),
  awsSessionToken: z.string().max(2048, "Session token is too long"),
});

function refineRecoveryMode(
  data: z.infer<typeof baseDatabaseFields>,
  ctx: z.RefinementCtx,
  requireAwsKeys: boolean,
  requireMongoUri: boolean
) {
  if (data.engine === "mongodb") {
    if (data.recoveryMode !== "direct") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MongoDB supports direct read-only checks only; Atlas restore is not available",
        path: ["recoveryMode"],
      });
    }
    const uri = data.connectionString.trim();
    if (requireMongoUri || uri) {
      const match = /^mongodb(?:\+srv)?:\/\/([^/?#\s]+)(?:[/?#]|$)/i.exec(uri);
      const hostList = match?.[1].split("@").at(-1)?.split(",");
      if (
        !match ||
        !hostList?.length ||
        hostList.some((host) => !host || host.startsWith(":")) ||
        /\s/.test(uri) ||
        uri.length > 2048
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid mongodb:// or mongodb+srv:// connection string",
          path: ["connectionString"],
        });
      }
    }
    if (!data.databaseName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MongoDB database name is required",
        path: ["databaseName"],
      });
    }
    return;
  }

  if (data.connectionString.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A MongoDB connection string is only used for MongoDB",
      path: ["connectionString"],
    });
  }
  if (data.host.length > 255) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Host is too long", path: ["host"] });
  }
  if (!Number.isInteger(data.port) || data.port < 1 || data.port > 65535) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Port must be between 1 and 65535",
      path: ["port"],
    });
  }
  if (data.databaseName.length > 255) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Database name is too long",
      path: ["databaseName"],
    });
  }
  if (data.username.length > 255) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Username is too long",
      path: ["username"],
    });
  }
  if (data.password.length > 512) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password is too long",
      path: ["password"],
    });
  }

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

  if (!data.host.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RDS endpoint (host) is required for snapshot checks on the live database",
      path: ["host"],
    });
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
    data.awsAccessKeyId.trim().length > 0 ||
    data.awsSecretAccessKey.trim().length > 0 ||
    data.awsSessionToken.trim().length > 0;

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
  refineRecoveryMode(
    data,
    ctx,
    data.recoveryMode === "aws-rds",
    data.engine === "mongodb"
  );
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
  refineRecoveryMode(data, ctx, false, false);
});

export type DatabaseWizardValues = z.infer<typeof databaseWizardSchema>;

export const wizardDefaults: DatabaseWizardValues = {
  name: "",
  description: "",
  engine: "postgres",
  recoveryMode: "aws-rds",
  connectionString: "",
  host: "",
  port: 5432,
  databaseName: "",
  username: "",
  password: "",
  sslMode: "require",
  region: "",
  rdsSourceIdentifier: "",
  recoveryUseFreetier: true,
  recoveryDrillsEnabled: false,
  recoverySandboxInstanceClass: "",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsSessionToken: "",
};

export const stepFields: Record<1 | 2 | 3 | 4, (keyof DatabaseWizardValues)[]> = {
  1: ["name", "description", "engine", "region", "recoveryMode"],
  2: [
    "connectionString",
    "host",
    "port",
    "databaseName",
    "username",
    "password",
    "sslMode",
    "rdsSourceIdentifier",
    "recoveryUseFreetier",
    "recoveryDrillsEnabled",
    "recoverySandboxInstanceClass",
    "awsAccessKeyId",
    "awsSecretAccessKey",
    "awsSessionToken",
  ],
  3: [],
  4: [],
};
