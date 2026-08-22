-- RPAS pilot credentials replace the medical certificate the registry used to
-- track. These are distinct from 'certification_expiring', which covers
-- training records such as BVLOS or night operations.
--
-- The medical_* kinds are left in place rather than dropped: removing an enum
-- value would break any notification row already carrying it.

alter type notification_kind add value if not exists 'pilot_certificate_expiring';
alter type notification_kind add value if not exists 'pilot_certificate_expired';
alter type notification_kind add value if not exists 'recency_due';
alter type notification_kind add value if not exists 'recency_overdue';
