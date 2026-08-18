# One-off scripts — NOT migrations

Scripts here are deliberately kept out of `supabase/migrations/` so they are
never replayed by `supabase db push`.

`20260817000001_reset_before_init.sql` drops every table. It existed to clear a
half-applied schema plus the extra tables Supabase's "Debug with Assistant"
generated while trying to auto-fix a failed migration. It has served its
purpose. Left in `migrations/`, a fresh environment would have created the
schema and then immediately dropped it.

Do not run it against a database with data you intend to keep.
