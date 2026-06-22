-- RPC: lista los productos de una entrega que NO tienen precio de taller vigente
-- configurado para el taller de esa entrega (los que caen al precio de venta como respaldo
-- en calculate_delivery_payment). Permite configurarlos desde la propia vista de la entrega.
--
-- Devuelve una fila POR PRODUCTO (no por variante/línea): workshop_pricing se define por
-- product_id, así que un solo precio cubre todas las variantes del producto en la entrega.
-- sale_unit_price = precio de venta de respaldo (referencia para sugerir el valor).
create or replace function public.get_delivery_missing_workshop_prices(delivery_id_param uuid)
returns table(
  product_id uuid,
  product_name text,
  sale_unit_price numeric,
  units integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  workshop_id_param uuid;
begin
  select d.workshop_id into workshop_id_param
  from deliveries d
  where d.id = delivery_id_param;

  return query
  select
    pv.product_id,
    p.name as product_name,
    max(oi.unit_price) as sale_unit_price,
    sum(di.quantity_delivered)::int as units
  from delivery_items di
  join order_items oi on di.order_item_id = oi.id
  join product_variants pv on oi.product_variant_id = pv.id
  join products p on pv.product_id = p.id
  left join lateral (
    select wp_inner.unit_price
    from workshop_pricing wp_inner
    where wp_inner.workshop_id = workshop_id_param
      and wp_inner.product_id = pv.product_id
      and wp_inner.effective_from <= current_date
      and (wp_inner.effective_until is null or wp_inner.effective_until > current_date)
    order by wp_inner.effective_from desc
    limit 1
  ) wp on true
  where di.delivery_id = delivery_id_param
    and wp.unit_price is null
  group by pv.product_id, p.name
  order by p.name;
end;
$function$;
