-- ROC-A (Restricted Operator Certificate — Aeronautical) is the radio licence
-- an RPAS crew needs to transmit on aeronautical frequencies. It is a separate
-- credential from the RPAS pilot certificate, so it gets its own category.
--
-- Kept in its own migration: Postgres will not let a newly added enum value be
-- used in the same transaction that adds it, and the next migration references
-- this value in a view.

alter type document_category add value if not exists 'roc_a';
