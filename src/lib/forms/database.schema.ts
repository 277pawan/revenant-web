import { z } from "zod";

/** Client form schema — mirrors API create with clearer UX messages */
export const databaseWizardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(255, "Display name is too long"),
  description: z.string().max(2000, "Description is too long"),
  engine: z.literal("postgres"),
  host: z
    .string()
    .trim()
    .min(1, "Host is required")
    .max(255, "Host is too long"),
  port: z.coerce
    .number({ invalid_type_error: "Port must be a number" })
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
  databaseName: z
    .string()
    .trim()
    .min(1, "Database name is required")
    .max(255, "Database name is too long"),
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(255, "Username is too long"),
  password: z.string().max(512, "Password is too long"),
  sslMode: z.enum(["require", "prefer", "disable"]),
  region: z.string().max(50, "Region is too long"),
});

export type DatabaseWizardValues = z.infer<typeof databaseWizardSchema>;

export const wizardDefaults: DatabaseWizardValues = {
  name: "",
  description: "",
  engine: "postgres",
  host: "",
  port: 5432,
  databaseName: "",
  username: "",
  password: "",
  sslMode: "require",
  region: "",
};

/** Fields validated when leaving each step */
export const stepFields: Record<1 | 2 | 3 | 4, (keyof DatabaseWizardValues)[]> = {
  1: ["name", "description", "region"],
  2: ["host", "port", "databaseName", "username", "password", "sslMode"],
  3: [],
  4: [],
};
