-- Ensure the paper_status enum includes the FIFA Data tag used by the app
alter type public.paper_status add value if not exists 'fifa_data';
