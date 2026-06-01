-- Backfill AngleOS fields from existing Dosmicos ad tags, products and hooks.
-- This is intentionally conservative: ambiguous rows remain needs_human_review=true.

UPDATE ad_tags
SET
  specific_angle = CASE
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) LIKE '%sleeping%'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(destapa|cobija|cobijas)'
      THEN 'sleeping_se_destapa_sin_cobijas'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) LIKE '%sleeping%'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(rutina|noche|dormir|tranquil)'
      THEN 'sleeping_rutina_noche_tranquila'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) LIKE '%sleeping%'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(tog|clima|temperatura|fr[ií]o|calor)'
      THEN 'sleeping_tog_clima_correcto'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(ruana|ruanas)'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(f[aá]cil|3 segundos|rap|af[aá]n)'
      THEN 'ruana_facil_de_poner'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(ruana|ruanas)'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(cobijita|cobija puesta|jugar|moverse|uso diario)'
      THEN 'ruana_cobijita_puesta'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(ruana|ruanas|oveja|vaca|oso)'
      AND lower(coalesce(hook_description, ad_name, product_name, '')) ~ '(animal|oveja|vaca|oso|tiern)'
      THEN 'ruana_animalitos_ninos_la_aman'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(ruana|ruanas)'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(regalo|baby shower|babyshower)'
      THEN 'ruana_regalo_util'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(parka|chaqueta|teddy|osito)'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(tierra fr[ií]a|clima fr[ií]o|viaje)'
      THEN 'parka_tierra_fria'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(parka|chaqueta|teddy|osito)'
      AND lower(coalesce(hook_description, ad_name, '')) ~ '(lluvia|viento|salida|salir|fr[ií]o)'
      THEN 'parka_frio_lluvia_salidas'
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '(suave|abriga|c[oó]mod|pr[aá]ctic)'
      THEN 'generic_product_benefit'
    ELSE COALESCE(specific_angle, 'unknown')
  END,
  hook_pattern = CASE
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '(antes|despu[eé]s|de sufrir|a dormir)' THEN 'antes_despues'
    WHEN coalesce(hook_description, ad_name, '') LIKE '%?%' OR lower(coalesce(hook_description, ad_name, '')) ~ '(tu beb[eé]|tu hijo|sab[ií]as|te pasa)' THEN 'pregunta_problema'
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '(pov|como mam[aá]|mi beb[eé]|mi hijo|nuestra rutina)' THEN 'pov_mama'
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '(3 segundos|mira c[oó]mo|se la pongo)' THEN 'demo_rapida'
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '(error|no hagas|deja de)' THEN 'error_comun'
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '( vs |en vez de|comparad)' THEN 'comparacion'
    WHEN lower(coalesce(hook_description, ad_name, '')) ~ '(te recomiendo|me encanta|favorita)' THEN 'recomendacion_amiga'
    ELSE COALESCE(hook_pattern, 'beneficio_directo')
  END,
  angle_family = CASE
    WHEN lower(coalesce(sales_angle, '')) IN ('dolor_problema') THEN 'problem_solution'
    WHEN lower(coalesce(sales_angle, '')) IN ('regalo') THEN 'gift'
    WHEN lower(coalesce(sales_angle, '')) IN ('educativo') THEN 'technical_education'
    WHEN lower(coalesce(sales_angle, '')) IN ('social_proof') THEN 'social_proof'
    WHEN lower(coalesce(sales_angle, '')) IN ('lifestyle') THEN 'lifestyle'
    WHEN lower(coalesce(sales_angle, '')) IN ('urgencia') THEN 'offer'
    WHEN lower(coalesce(sales_angle, '')) IN ('beneficio_producto') THEN 'product_benefit'
    ELSE COALESCE(angle_family, 'other')
  END,
  buyer_problem = CASE
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) LIKE '%sleeping%' AND lower(coalesce(hook_description, ad_name, '')) ~ '(destapa|cobija)' THEN 'bebe_se_destapa'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(ruana|ruanas)' AND lower(coalesce(hook_description, ad_name, '')) ~ '(f[aá]cil|3 segundos|af[aá]n)' THEN 'chaquetas_dificiles_o_afan'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(parka|chaqueta)' AND lower(coalesce(hook_description, ad_name, '')) ~ '(tierra fr[ií]a|clima fr[ií]o|viaje)' THEN 'viaje_o_clima_frio_real'
    ELSE COALESCE(buyer_problem, 'unknown')
  END,
  desired_outcome = CASE
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) LIKE '%sleeping%' AND lower(coalesce(hook_description, ad_name, '')) ~ '(destapa|cobija)' THEN 'duerme_abrigado_sin_cobijas_sueltas'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(ruana|ruanas)' AND lower(coalesce(hook_description, ad_name, '')) ~ '(f[aá]cil|3 segundos|af[aá]n)' THEN 'poner_en_segundos'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(parka|chaqueta)' AND lower(coalesce(hook_description, ad_name, '')) ~ '(tierra fr[ií]a|clima fr[ií]o|viaje)' THEN 'abrigo_funcional_para_tierra_fria'
    ELSE COALESCE(desired_outcome, 'unknown')
  END,
  proof_type = CASE
    WHEN lower(coalesce(creative_type, '')) = 'ugc' THEN 'producto_en_uso_real'
    WHEN lower(coalesce(copy_type, '')) IN ('testimonio') THEN 'testimonio_mama'
    WHEN lower(coalesce(copy_type, '')) IN ('before_after') THEN 'antes_despues'
    ELSE COALESCE(proof_type, 'unknown')
  END,
  angle_confidence = CASE
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(sleeping|ruana|ruanas|parka|chaqueta)'
      AND lower(coalesce(hook_description, ad_name, product_name, '')) ~ '(destapa|cobija|rutina|noche|tog|clima|f[aá]cil|3 segundos|uso diario|animal|oveja|vaca|oso|regalo|tierra fr[ií]a|viaje|lluvia|viento|salida)'
      THEN 'high'
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(sleeping|ruana|ruanas|parka|chaqueta)' THEN 'medium'
    ELSE 'low'
  END,
  needs_human_review = CASE
    WHEN lower(coalesce(product_name, product, ad_name, hook_description, '')) ~ '(sleeping|ruana|ruanas|parka|chaqueta)'
      AND lower(coalesce(hook_description, ad_name, product_name, '')) ~ '(destapa|cobija|rutina|noche|tog|clima|f[aá]cil|3 segundos|uso diario|animal|oveja|vaca|oso|regalo|tierra fr[ií]a|viaje|lluvia|viento|salida)'
      THEN FALSE
    ELSE TRUE
  END,
  updated_at = now()
WHERE organization_id IS NOT NULL;
