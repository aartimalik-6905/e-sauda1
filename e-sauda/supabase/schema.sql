create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;