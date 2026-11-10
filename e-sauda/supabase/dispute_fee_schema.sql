-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/dispute-fee: when a buyer cancels a funded Vault order that already has a
-- delivery rider arranged (assigned or already delivered), the refund deducts that
-- rider's fee instead of refunding the full amount — "keeping the ecosystem fair for
-- transit riders" per the blueprint's dispute protocol. If no delivery was ever
-- arranged (an in-person meetup), cancelling still refunds the full amount — there's
-- no logistics cost to recover.
--
-- HONEST SCOPE NOTE: as with vault_orders and deliveries, no real money moves. This
-- records what a real refund/deduction would be (refund_amount, deducted_fee) so the
-- UI can show it accurately — swapping in a real payment gateway later means actually
-- transferring refund_amount instead of amount, nothing else in this flow changes.
--
-- Prerequisite: supabase/vault_schema.sql and supabase/delivery_schema.sql must
-- already be applied.

alter table public.vault_orders
  add column if not exists refund_amount numeric,
  add column if not exists deducted_fee numeric not null default 0;

-- Replaces the version of cancel_vault_order from vault_schema.sql — same signature,
-- same ownership/status checks, now with the fee-deduction logic added.
create or replace function public.cancel_vault_order(p_order_id uuid, p_reason text)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.vault_orders;
  v_delivery public.deliveries;
  v_deducted numeric := 0;
  v_refund numeric;
begin
  select * into v_order from public.vault_orders where id = p_order_id for update;

  if v_order is null or (v_order.buyer_id <> auth.uid() and v_order.seller_id <> auth.uid()) then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'funded' then
    raise exception 'This order can no longer be cancelled';
  end if;

  -- A rider trip already happened (or is happening) if a delivery was arranged and
  -- hasn't itself already been cancelled. Deduct its fee from the refund, capped so
  -- the refund never goes negative on an unusually small order.
  --
  -- NOTE: this uses `FOUND` (Postgres's built-in flag set by the preceding SELECT
  -- INTO), not `v_delivery IS NOT NULL`. That distinction matters here: a row type
  -- like `deliveries` is only "IS NOT NULL" per SQL's composite-type rules if EVERY
  -- column is non-null — but an 'assigned' (not yet delivered) delivery has
  -- delivered_at = NULL, a legitimate value for that state. A row with a mix of
  -- null and non-null fields is neither "IS NULL" nor "IS NOT NULL" (both evaluate
  -- false), so checking `IS NOT NULL` here silently treated a found delivery as if
  -- none existed, and the fee was never deducted. FOUND doesn't have this problem —
  -- it just reports whether the SELECT matched a row.
  select * into v_delivery from public.deliveries
    where vault_order_id = p_order_id and status in ('assigned', 'delivered')
    for update;

  if found then
    v_deducted := least(v_delivery.fee, v_order.amount);
    update public.deliveries set status = 'cancelled' where id = v_delivery.id;
  end if;

  v_refund := v_order.amount - v_deducted;

  update public.vault_orders
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = p_reason,
    deducted_fee = v_deducted,
    refund_amount = v_refund
  where id = p_order_id
  returning * into v_order;

  update public.listings set status = 'active' where id = v_order.listing_id and status = 'sold';

  return v_order;
end;
$$;

grant execute on function public.cancel_vault_order(uuid, text) to authenticated;
