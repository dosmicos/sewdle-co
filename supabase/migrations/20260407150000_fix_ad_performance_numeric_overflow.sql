-- Fix numeric field overflow (error 22003) on ad_performance_daily
-- Columns with NUMERIC(6,x) were too narrow, causing entire upsert batches
-- to fail when values exceeded the column precision (e.g. CTR > 99.9999).
-- Widen to NUMERIC(10,x) to prevent overflow.

ALTER TABLE ad_performance_daily
  ALTER COLUMN ctr          TYPE NUMERIC(10,4),
  ALTER COLUMN lp_conv_rate TYPE NUMERIC(10,4),
  ALTER COLUMN atc_rate     TYPE NUMERIC(10,4),
  ALTER COLUMN hook_rate    TYPE NUMERIC(10,2),
  ALTER COLUMN hold_rate    TYPE NUMERIC(10,2),
  ALTER COLUMN frequency    TYPE NUMERIC(10,2);
