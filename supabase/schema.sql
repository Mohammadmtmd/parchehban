-- ═══════════════════════════════════════════════════════════════════
--  پارچه‌بان — طرح پایگاه داده برای Supabase (PostgreSQL)
--
--  این فایل هنوز در برنامه استفاده نمی‌شود. برای زمانی آماده شده که
--  خواستید ذخیره‌سازی را از مرورگر به سرور منتقل کنید تا از چند
--  دستگاه به داده‌های یکسان دسترسی داشته باشید.
--
--  اصول طراحی:
--    • کلید اصلی هر جدول uuid است، نه شماره ترتیبی. چون شماره ترتیبی
--      IndexedDB روی هر دستگاه از ۱ شروع می‌شود و در ادغام تصادم
--      می‌کند. برنامه از قبل برای هر رکورد فیلد uid تولید می‌کند.
--    • هر جدول ستون org_id دارد؛ داده هر کاربر/کسب‌وکار از دیگری جدا
--      است و Row Level Security بر همین اساس اعمال می‌شود.
--    • updated_at برای حل تعارض (آخرین نویسنده برنده) و همگام‌سازی
--      تدریجی استفاده می‌شود.
--    • مبالغ به صورت numeric(18,2) هستند نه float، تا خطای گرد کردن
--      اعشاری در حسابداری پیش نیاید.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── سازمان (کسب‌وکار) و اعضا ─────────────────────────────────────
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- نقش‌ها دقیقاً همان چهار نقش برنامه هستند
create type app_role as enum ('admin', 'accountant', 'operator', 'viewer');

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        app_role not null default 'viewer',
  active      boolean not null default true,
  display_name text,
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ── تعاریف پایه ──────────────────────────────────────────────────
create table if not exists fiscal_years (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  start_date  text not null,          -- تاریخ شمسی «1404/01/01»
  end_date    text not null,
  is_current  boolean not null default false,
  is_closed   boolean not null default false,
  closed_at   timestamptz,
  closed_to_year_id uuid references fiscal_years(id),
  updated_at  timestamptz not null default now()
);

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  updated_at  timestamptz not null default now()
);

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  code        text,
  unit        text,
  category_id uuid references categories(id) on delete set null,
  color_catalog text,
  purchase_price numeric(18,2) default 0,
  sale_price     numeric(18,2) default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  type        text,                   -- customer / supplier / broker
  phone       text,
  address     text,
  -- عرف حسابداری: مثبت = بدهکار، منفی = بستانکار
  balance     numeric(18,2) not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists banks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  title       text not null,
  bank_name   text,
  account_number text,
  opening_balance numeric(18,2) not null default 0,
  updated_at  timestamptz not null default now()
);

-- ── اسناد ────────────────────────────────────────────────────────
create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  fiscal_year_id uuid references fiscal_years(id) on delete set null,
  type          text not null check (type in ('sale','purchase','proforma')),
  invoice_number text,
  date          text not null,
  contact_id    uuid references contacts(id) on delete restrict,
  broker_id     uuid references contacts(id) on delete set null,
  broker_commission numeric(18,2) default 0,
  subtotal      numeric(18,2) not null default 0,
  shipping_cost numeric(18,2) not null default 0,
  discount      numeric(18,2) not null default 0,
  grand_total   numeric(18,2) not null default 0,
  paid_amount   numeric(18,2) not null default 0,
  bank_id       uuid references banks(id) on delete set null,
  print_size    text default 'a4',
  notes         text,
  created_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  unique (org_id, fiscal_year_id, type, invoice_number)
);

-- ردیف‌های فاکتور: در نسخه مرورگری داخل خود فاکتور آرایه بودند.
-- در پایگاه داده رابطه‌ای، جدول جدا درست‌تر است (امکان گزارش‌گیری
-- مستقیم روی کالاها).
create table if not exists invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  product_id  uuid references products(id) on delete restrict,
  quantity    numeric(18,3) not null default 0,
  unit_price  numeric(18,2) not null default 0,
  total       numeric(18,2) not null default 0,
  line_no     int not null default 0
);

create table if not exists payments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  fiscal_year_id uuid references fiscal_years(id) on delete set null,
  type          text not null check (type in ('receipt','payment')),
  contact_id    uuid references contacts(id) on delete restrict,
  amount        numeric(18,2) not null default 0,
  date          text not null,
  bank_id       uuid references banks(id) on delete set null,
  description   text,
  -- سند خودکارِ ساخته‌شده از فیلد «پرداخت شده» فاکتور
  source_invoice_id uuid references invoices(id) on delete cascade,
  is_auto       boolean not null default false,
  transfer_id   uuid,
  updated_at    timestamptz not null default now()
);
-- هر فاکتور حداکثر یک سند خودکار داشته باشد
create unique index if not exists payments_one_auto_per_invoice
  on payments (source_invoice_id) where source_invoice_id is not null;

create table if not exists checks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  fiscal_year_id uuid references fiscal_years(id) on delete set null,
  type          text not null check (type in ('received','issued')),
  check_number  text,
  contact_id    uuid references contacts(id) on delete restrict,
  amount        numeric(18,2) not null default 0,
  issue_date    text,
  due_date      text,
  bank_name     text,
  bank_account_id uuid references banks(id) on delete set null,
  status        text not null default 'pending',
  notes         text,
  updated_at    timestamptz not null default now()
);

create table if not exists bank_transfers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  fiscal_year_id uuid references fiscal_years(id) on delete set null,
  from_bank_id  uuid references banks(id) on delete restrict,
  to_bank_id    uuid references banks(id) on delete restrict,
  amount        numeric(18,2) not null default 0,
  date          text not null,
  description   text,
  updated_at    timestamptz not null default now(),
  check (from_bank_id <> to_bank_id)
);

-- مانده اولیه اشخاص در هر سال مالی (نتیجه بستن سال قبل)
create table if not exists year_openings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  fiscal_year_id uuid not null references fiscal_years(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  balance       numeric(18,2) not null default 0,
  carried_from_year_id uuid references fiscal_years(id),
  updated_at    timestamptz not null default now(),
  unique (fiscal_year_id, contact_id)
);

-- ── ایندکس‌های پرکاربرد ──────────────────────────────────────────
create index if not exists idx_invoices_org_year   on invoices (org_id, fiscal_year_id);
create index if not exists idx_invoices_contact    on invoices (contact_id);
create index if not exists idx_invoices_date       on invoices (date);
create index if not exists idx_items_invoice       on invoice_items (invoice_id);
create index if not exists idx_items_product       on invoice_items (product_id);
create index if not exists idx_payments_org_year   on payments (org_id, fiscal_year_id);
create index if not exists idx_payments_contact    on payments (contact_id);
create index if not exists idx_checks_org_year     on checks (org_id, fiscal_year_id);
create index if not exists idx_checks_due          on checks (due_date);

-- ── به‌روزرسانی خودکار updated_at ────────────────────────────────
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['fiscal_years','categories','products','contacts',
                           'banks','invoices','payments','checks',
                           'bank_transfers','year_openings']
  loop
    execute format(
      'drop trigger if exists trg_touch_%1$s on %1$s;
       create trigger trg_touch_%1$s before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────
-- امنیت واقعی اینجاست: هر کاربر فقط داده سازمان خودش را می‌بیند و
-- سطح دسترسی‌اش در سرور اعمال می‌شود، نه در رابط کاربری.

create or replace function my_role(target_org uuid) returns app_role as $$
  select role from memberships
   where org_id = target_org and user_id = auth.uid() and active
   limit 1
$$ language sql stable security definer;

create or replace function can_write(target_org uuid) returns boolean as $$
  select coalesce(my_role(target_org) in ('admin','accountant','operator'), false)
$$ language sql stable security definer;

create or replace function can_delete(target_org uuid) returns boolean as $$
  select coalesce(my_role(target_org) in ('admin','accountant'), false)
$$ language sql stable security definer;

do $$
declare t text;
begin
  foreach t in array array['fiscal_years','categories','products','contacts',
                           'banks','invoices','payments','checks',
                           'bank_transfers','year_openings']
  loop
    execute format('alter table %1$s enable row level security;', t);
    execute format('drop policy if exists p_sel_%1$s on %1$s;
      create policy p_sel_%1$s on %1$s for select
      using (my_role(org_id) is not null);', t);
    execute format('drop policy if exists p_ins_%1$s on %1$s;
      create policy p_ins_%1$s on %1$s for insert
      with check (can_write(org_id));', t);
    execute format('drop policy if exists p_upd_%1$s on %1$s;
      create policy p_upd_%1$s on %1$s for update
      using (can_write(org_id)) with check (can_write(org_id));', t);
    execute format('drop policy if exists p_del_%1$s on %1$s;
      create policy p_del_%1$s on %1$s for delete
      using (can_delete(org_id));', t);
  end loop;
end $$;

-- ردیف‌های فاکتور از دسترسی خود فاکتور ارث می‌برند
alter table invoice_items enable row level security;
drop policy if exists p_items_all on invoice_items;
create policy p_items_all on invoice_items for all
  using (exists (select 1 from invoices i
                  where i.id = invoice_id and my_role(i.org_id) is not null))
  with check (exists (select 1 from invoices i
                  where i.id = invoice_id and can_write(i.org_id)));

-- سند بسته‌شدن سال مالی نباید تغییر کند
create or replace function block_closed_year() returns trigger as $$
declare closed boolean;
begin
  select is_closed into closed from fiscal_years
   where id = coalesce(new.fiscal_year_id, old.fiscal_year_id);
  if closed then
    raise exception 'سال مالی بسته شده است و امکان تغییر سند وجود ندارد';
  end if;
  return coalesce(new, old);
end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['invoices','payments','checks','bank_transfers']
  loop
    execute format(
      'drop trigger if exists trg_closed_%1$s on %1$s;
       create trigger trg_closed_%1$s before insert or update or delete on %1$s
       for each row execute function block_closed_year();', t);
  end loop;
end $$;
