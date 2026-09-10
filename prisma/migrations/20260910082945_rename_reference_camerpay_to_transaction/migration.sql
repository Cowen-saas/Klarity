-- Rename Paiement.referenceCamerPay -> referenceTransaction (CamerPay never had
-- real access; replaced by NotchPay, v1.32). Data-preserving column rename, not
-- a drop+recreate — `prisma migrate dev` refuses this automatically because it
-- can't infer a rename from the schema diff alone, so this migration was
-- written by hand instead of generated.
ALTER TABLE "paiements" RENAME COLUMN "referenceCamerPay" TO "referenceTransaction";

-- WebhookLog.provider is now always set explicitly by traiterWebhookPaiement()
-- ("MOCK"/"NOTCHPAY") — the "CAMERPAY" default was dead weight and, worse,
-- silently wrong for every row it had ever applied to by default.
ALTER TABLE "webhook_logs" ALTER COLUMN "provider" DROP DEFAULT;
