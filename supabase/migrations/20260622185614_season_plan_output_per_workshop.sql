-- Capacidad del Plan de Temporada expresada en TALLERES: guardamos la producción
-- por taller/semana para poder reformular la capacidad (base/meta) en número de
-- talleres en la UI y mostrar "cuántos talleres necesitas". El motor de rampa no
-- cambia: sigue usando baseline_weekly_capacity y target_weekly_capacity (que la UI
-- calcula como talleres × producción_por_taller).
alter table public.season_production_plans
  add column if not exists output_per_workshop numeric;

comment on column public.season_production_plans.output_per_workshop is
  'Producción aprobada por taller por semana (uds). Permite expresar la capacidad base/meta como número de talleres y crecer la capacidad gradualmente al abrir talleres.';
