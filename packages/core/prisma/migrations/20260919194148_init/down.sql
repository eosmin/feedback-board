-- Rollback for 20260919194148_init. Verified once against a scratch database (TDD §2.6.4).
-- Drops in FK-safe order: children before parents, then the enums nothing else depends on.

DROP TABLE IF EXISTS "webhook_deliveries";
DROP TABLE IF EXISTS "webhooks";
DROP TABLE IF EXISTS "stripe_events";
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "comments";
DROP TABLE IF EXISTS "votes";
DROP TABLE IF EXISTS "posts";
DROP TABLE IF EXISTS "boards";
DROP TABLE IF EXISTS "memberships";
DROP TABLE IF EXISTS "orgs";
DROP TABLE IF EXISTS "users";

DROP TYPE IF EXISTS "PostPriority";
DROP TYPE IF EXISTS "PostCategory";
DROP TYPE IF EXISTS "PostStatus";
DROP TYPE IF EXISTS "Role";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "Plan";