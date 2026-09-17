import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const adminUsersTable = pgTable("ih_admin_users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("admin"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  passwordOperationId: text("password_operation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ih_admin_users_email_unique").on(table.email),
  uniqueIndex("ih_admin_users_one_superadmin")
    .on(table.role)
    .where(sql`${table.role} = 'superadmin'`),
  check("ih_admin_users_role_check", sql`${table.role} IN ('admin', 'superadmin')`),
]);

/** An exact email authorization waiting for its verified Clerk primary email to claim it. */
export const adminPendingApprovalsTable = pgTable("ih_admin_pending_approvals", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A durable denial for a revoked email. It prevents an old bootstrap setting
 * from silently recreating access; an administrator must explicitly approve
 * the email again to clear it.
 */
export const adminRevocationsTable = pgTable("ih_admin_revocations", {
  email: text("email").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Server-authored history of administrator access changes. */
export const adminAccessAuditTable = pgTable("ih_admin_access_audit", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  actorClerkUserId: text("actor_clerk_user_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  targetEmail: text("target_email").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ih_admin_access_audit_created_idx").on(table.createdAt),
]);

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type AdminPendingApproval = typeof adminPendingApprovalsTable.$inferSelect;
export type AdminRevocation = typeof adminRevocationsTable.$inferSelect;
export type AdminAccessAudit = typeof adminAccessAuditTable.$inferSelect;