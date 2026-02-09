-- Ensure the paper_status enum includes the Aspetar ASPREV tag used by the app
alter type public.paper_status add value if not exists 'aspetar_asprev';
