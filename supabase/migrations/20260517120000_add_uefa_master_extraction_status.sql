-- Ensure the paper_status enum includes the synthetic UEFA master extraction tag.
alter type public.paper_status add value if not exists 'uefa_master_extraction';
