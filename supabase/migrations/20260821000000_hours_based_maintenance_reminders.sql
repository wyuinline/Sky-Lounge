-- ============================================================================
-- Hours-based maintenance reminders.
--
-- The reminder scan only understood calendar due dates, so an airframe sitting
-- at 199 of its 200 flight hours was never flagged. These kinds let the scan
-- report on the hour interval as well.
--
-- Added, not renamed: the date-based kinds are still correct for work that
-- genuinely has a calendar due date.
-- ============================================================================

alter type notification_kind add value if not exists 'maintenance_hours_due';
alter type notification_kind add value if not exists 'maintenance_hours_overdue';
