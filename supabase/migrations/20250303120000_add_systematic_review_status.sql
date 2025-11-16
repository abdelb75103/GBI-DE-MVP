-- Ensure the paper_status enum includes the Systematic Review tag used by the app
alter type public.paper_status add value if not exists 'systematic_review';
