-- CRITICAL: create or replace only overwrites a function with the exact same argument
-- signature. Since this version adds a parameter, without an explicit drop the OLD
-- create_vault_order(uuid) -- with no payment check at all -- would keep existing
-- alongside the new one, and anyone could still call it to get a free listing.
drop function if exists public.create_vault_order(uuid);

-- Replaces the version in vault_schema.sql: same logic, plus a mandatory payment
-- check at the top and storing which Razorpay payment funded this order.
create or replace function public.create_vault_order(p_listing_id uuid, p_razorpay_order_id text)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_payment record;
  v_otp text;
  v_order public.vault_orders;
begin
  select * into v_listing from public.listings where id = p_listing_id for update;

  if v_listing is null then
    raise exception 'Listing not found';
  end if;
  if v_listing.owner_id = auth.uid() then
    raise exception 'You cannot buy your own listing';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'This listing is no longer available';
  end if;

  select * into v_payment
  from public.razorpay_payments
  where razorpay_order_id = p_razorpay_order_id
    and listing_id = p_listing_id
    and buyer_id = auth.uid()
    and consumed_at is null
  for update;

  if v_payment is null then
    raise exception 'No verified payment found for this order';
  end if;
  if v_payment.amount <> v_listing.price then
    raise exception 'Payment amount does not match listing price';
  end if;

  update public.razorpay_payments set consumed_at = now() where id = v_payment.id;

  v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  insert into public.vault_orders
    (listing_id, buyer_id, seller_id, amount, handover_otp, razorpay_order_id, razorpay_payment_id)
  values
    (p_listing_id, auth.uid(), v_listing.owner_id, v_listing.price, v_otp,
     v_payment.razorpay_order_id, v_payment.razorpay_payment_id)
  returning * into v_order;

  update public.listings set status = 'sold' where id = p_listing_id;

  return v_order;
end;
$$;

alter table public.vault_orders add column if not exists razorpay_order_id text;
alter table public.vault_orders add column if not exists razorpay_payment_id text;

grant execute on function public.create_vault_order(uuid, text) to authenticated;