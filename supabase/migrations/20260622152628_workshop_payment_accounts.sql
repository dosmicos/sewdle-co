-- Datos de pago por taller: para saber a qué llave Bre-B o cuenta bancaria se le
-- transfiere a cada taller al momento de marcar un pago de entrega como pagado.
-- Todas las columnas son opcionales (un taller se paga por Bre-B O por cuenta bancaria).
alter table public.workshops
  add column if not exists bre_b text,
  add column if not exists bank_name text,
  add column if not exists bank_account_type text,
  add column if not exists bank_account_number text,
  add column if not exists account_holder text,
  add column if not exists account_holder_document text;

comment on column public.workshops.bre_b is 'Llave Bre-B del taller (celular, cédula, correo o llave alfanumérica) para transferencias.';
comment on column public.workshops.bank_name is 'Banco/entidad de la cuenta del taller (Bancolombia, Nequi, etc.).';
comment on column public.workshops.bank_account_type is 'Tipo de cuenta: ahorros | corriente | nequi | daviplata.';
comment on column public.workshops.bank_account_number is 'Número de cuenta del taller.';
comment on column public.workshops.account_holder is 'Nombre del titular de la cuenta.';
comment on column public.workshops.account_holder_document is 'Documento (cédula/NIT) del titular de la cuenta.';
