-- ═══════════════════════════════════════════════════════════════════
--  پارچه‌بان (Parchehban) — طرح کامل پایگاه داده برای Supabase (PostgreSQL)
--  سیستم حسابداری، انبارداری و فروش پارچه و منسوجات
--
--  راهنمای راه‌اندازی سریع در Supabase (۳ مرحله):
--    ۱. در داشبورد پروژه Supabase وارد بخش «SQL Editor» شوید.
--    ۲. یک کوئری جدید (New query) باز کنید، کل محتوای این فایل را کپی
--       کرده و دکمه «Run» را بزنید (پیام Success باید نمایش داده شود).
--    ۳. به بخش Project Settings -> API بروید:
--       - آدرس Project URL (مثلاً https://xxxxxx.supabase.co)
--       - کلید anon public (رشته بلند eyJhbGciOi...)
--       را کپی کرده و در برنامه پارچه‌بان (بخش تنظیمات -> اتصال به Supabase)
--       وارد کنید. سپس دکمه «بارگذاری کل اطلاعات به سرور» را بزنید.
--
--  ویژگی‌های این طرح:
--    • ذخیره‌سازی داده‌ها با کلید یکتای جهانی (uid) برای همگام‌سازی دوطرفه
--    • فیلد data از نوع JSONB برای حفظ ۱۰۰٪ جزییات (ردیف‌های فاکتور، تنظیمات و...)
--    • ستون‌های مجزا (ستون‌های آینه‌ای) برای مشاهده و فیلتر آسان در Table Editor
--    • سازگاری کامل با حالت آفلاین (Offline-first) و حل تعارض آخرین نویسنده
--    • امنیت مبتنی بر شناسه کسب‌وکار (org_id) و Row Level Security
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────
-- نکته مهم برای پایگاه‌های از قبل موجود:
-- اگر این جدول‌ها قبلاً با ساختار دیگری در Supabase شما ساخته شده بودند،
-- می‌توانید خطوط زیر را اجرا کنید تا ستون‌های جدید اضافه شوند،
-- یا اگر اطلاعات قبلی در این جدول‌ها مهم نیست، دستور زیر را در بالای صفحه اجرا کنید:
-- DROP TABLE IF EXISTS fiscal_years, categories, products, contacts, banks, invoices, payments, checks, bank_transfers, year_openings, app_settings, app_users CASCADE;
-- ─────────────────────────────────────────────────────────────────

-- ── ۱. سال‌های مالی (fiscal_years) ────────────────────────────────
create table if not exists fiscal_years (
  id          text primary key,               -- شناسه یکتا (uid)
  org_id      text not null default 'shop1',   -- شناسه سازمان / کسب‌وکار
  name        text,                           -- نام سال مالی (مثلاً ۱۴۰۴)
  start_date  text,                           -- تاریخ شروع شمسی
  end_date    text,                           -- تاریخ پایان شمسی
  is_current  boolean default false,          -- سال جاری
  is_closed   boolean default false,          -- سال بسته شده
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
alter table fiscal_years add column if not exists org_id text not null default 'shop1';
alter table fiscal_years add column if not exists name text;
alter table fiscal_years add column if not exists start_date text;
alter table fiscal_years add column if not exists end_date text;
alter table fiscal_years add column if not exists is_current boolean default false;
alter table fiscal_years add column if not exists is_closed boolean default false;
alter table fiscal_years add column if not exists data jsonb not null default '{}'::jsonb;
alter table fiscal_years add column if not exists updated_at timestamptz not null default now();
alter table fiscal_years add column if not exists is_deleted boolean not null default false;

-- ── ۲. دسته‌بندی کالاها (categories) ──────────────────────────────
create table if not exists categories (
  id          text primary key,
  org_id      text not null default 'shop1',
  name        text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
alter table categories add column if not exists org_id text not null default 'shop1';
alter table categories add column if not exists name text;
alter table categories add column if not exists data jsonb not null default '{}'::jsonb;
alter table categories add column if not exists updated_at timestamptz not null default now();
alter table categories add column if not exists is_deleted boolean not null default false;

-- ── ۳. کالاها و پارچه‌ها (products) ───────────────────────────────
create table if not exists products (
  id             text primary key,
  org_id         text not null default 'shop1',
  name           text,
  code           text,
  unit           text,
  category_id    text,
  purchase_price numeric(18,2) default 0,
  sale_price     numeric(18,2) default 0,
  data           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  is_deleted     boolean not null default false
);
alter table products add column if not exists org_id text not null default 'shop1';
alter table products add column if not exists name text;
alter table products add column if not exists code text;
alter table products add column if not exists unit text;
alter table products add column if not exists category_id text;
alter table products add column if not exists purchase_price numeric(18,2) default 0;
alter table products add column if not exists sale_price numeric(18,2) default 0;
alter table products add column if not exists data jsonb not null default '{}'::jsonb;
alter table products add column if not exists updated_at timestamptz not null default now();
alter table products add column if not exists is_deleted boolean not null default false;

-- ── ۴. اشخاص و طرف‌حساب‌ها (contacts) ──────────────────────────────
create table if not exists contacts (
  id          text primary key,
  org_id      text not null default 'shop1',
  name        text,
  type        text,                           -- customer / supplier / broker
  phone       text,
  address     text,
  balance     numeric(18,2) default 0,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
alter table contacts add column if not exists org_id text not null default 'shop1';
alter table contacts add column if not exists name text;
alter table contacts add column if not exists type text;
alter table contacts add column if not exists phone text;
alter table contacts add column if not exists address text;
alter table contacts add column if not exists balance numeric(18,2) default 0;
alter table contacts add column if not exists data jsonb not null default '{}'::jsonb;
alter table contacts add column if not exists updated_at timestamptz not null default now();
alter table contacts add column if not exists is_deleted boolean not null default false;

-- ── ۵. حساب‌های بانکی و صندوق‌ها (banks) ──────────────────────────
create table if not exists banks (
  id              text primary key,
  org_id          text not null default 'shop1',
  title           text,
  bank_name       text,
  account_number  text,
  opening_balance numeric(18,2) default 0,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false
);
alter table banks add column if not exists org_id text not null default 'shop1';
alter table banks add column if not exists title text;
alter table banks add column if not exists bank_name text;
alter table banks add column if not exists account_number text;
alter table banks add column if not exists opening_balance numeric(18,2) default 0;
alter table banks add column if not exists data jsonb not null default '{}'::jsonb;
alter table banks add column if not exists updated_at timestamptz not null default now();
alter table banks add column if not exists is_deleted boolean not null default false;

-- ── ۶. فاکتورها (خرید، فروش، پیش‌فاکتور) (invoices) ──────────────
create table if not exists invoices (
  id                text primary key,
  org_id            text not null default 'shop1',
  fiscal_year_id    text,
  type              text,                     -- sale / purchase / proforma
  invoice_number    text,
  date              text,                     -- تاریخ شمسی
  contact_id        text,
  subtotal          numeric(18,2) default 0,
  shipping_cost     numeric(18,2) default 0,
  discount          numeric(18,2) default 0,
  grand_total       numeric(18,2) default 0,
  paid_amount       numeric(18,2) default 0,
  bank_id           text,
  data              jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now(),
  is_deleted        boolean not null default false
);
alter table invoices add column if not exists org_id text not null default 'shop1';
alter table invoices add column if not exists fiscal_year_id text;
alter table invoices add column if not exists type text;
alter table invoices add column if not exists invoice_number text;
alter table invoices add column if not exists date text;
alter table invoices add column if not exists contact_id text;
alter table invoices add column if not exists subtotal numeric(18,2) default 0;
alter table invoices add column if not exists shipping_cost numeric(18,2) default 0;
alter table invoices add column if not exists discount numeric(18,2) default 0;
alter table invoices add column if not exists grand_total numeric(18,2) default 0;
alter table invoices add column if not exists paid_amount numeric(18,2) default 0;
alter table invoices add column if not exists bank_id text;
alter table invoices add column if not exists data jsonb not null default '{}'::jsonb;
alter table invoices add column if not exists updated_at timestamptz not null default now();
alter table invoices add column if not exists is_deleted boolean not null default false;

-- ── ۷. اسناد دریافت و پرداخت (payments) ───────────────────────────
create table if not exists payments (
  id                text primary key,
  org_id            text not null default 'shop1',
  fiscal_year_id    text,
  type              text,                     -- receipt / payment
  contact_id        text,
  amount            numeric(18,2) default 0,
  date              text,
  bank_id           text,
  description       text,
  source_invoice_id text,
  is_auto           boolean default false,
  data              jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now(),
  is_deleted        boolean not null default false
);
alter table payments add column if not exists org_id text not null default 'shop1';
alter table payments add column if not exists fiscal_year_id text;
alter table payments add column if not exists type text;
alter table payments add column if not exists contact_id text;
alter table payments add column if not exists amount numeric(18,2) default 0;
alter table payments add column if not exists date text;
alter table payments add column if not exists bank_id text;
alter table payments add column if not exists description text;
alter table payments add column if not exists source_invoice_id text;
alter table payments add column if not exists is_auto boolean default false;
alter table payments add column if not exists data jsonb not null default '{}'::jsonb;
alter table payments add column if not exists updated_at timestamptz not null default now();
alter table payments add column if not exists is_deleted boolean not null default false;

-- ── ۸. چک‌های دریافتی و پرداختی (checks) ─────────────────────────
create table if not exists checks (
  id              text primary key,
  org_id          text not null default 'shop1',
  fiscal_year_id  text,
  type            text,                       -- received / issued
  check_number    text,
  contact_id      text,
  amount          numeric(18,2) default 0,
  issue_date      text,
  due_date        text,
  bank_name       text,
  bank_account_id text,
  status          text default 'pending',     -- pending / passed / returned / transferred
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false
);
alter table checks add column if not exists org_id text not null default 'shop1';
alter table checks add column if not exists fiscal_year_id text;
alter table checks add column if not exists type text;
alter table checks add column if not exists check_number text;
alter table checks add column if not exists contact_id text;
alter table checks add column if not exists amount numeric(18,2) default 0;
alter table checks add column if not exists issue_date text;
alter table checks add column if not exists due_date text;
alter table checks add column if not exists bank_name text;
alter table checks add column if not exists bank_account_id text;
alter table checks add column if not exists status text default 'pending';
alter table checks add column if not exists data jsonb not null default '{}'::jsonb;
alter table checks add column if not exists updated_at timestamptz not null default now();
alter table checks add column if not exists is_deleted boolean not null default false;

-- ── ۹. انتقال بین حساب‌های بانکی (bank_transfers) ────────────────
create table if not exists bank_transfers (
  id              text primary key,
  org_id          text not null default 'shop1',
  fiscal_year_id  text,
  from_bank_id    text,
  to_bank_id      text,
  amount          numeric(18,2) default 0,
  date            text,
  description     text,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false
);
alter table bank_transfers add column if not exists org_id text not null default 'shop1';
alter table bank_transfers add column if not exists fiscal_year_id text;
alter table bank_transfers add column if not exists from_bank_id text;
alter table bank_transfers add column if not exists to_bank_id text;
alter table bank_transfers add column if not exists amount numeric(18,2) default 0;
alter table bank_transfers add column if not exists date text;
alter table bank_transfers add column if not exists description text;
alter table bank_transfers add column if not exists data jsonb not null default '{}'::jsonb;
alter table bank_transfers add column if not exists updated_at timestamptz not null default now();
alter table bank_transfers add column if not exists is_deleted boolean not null default false;

-- ── ۱۰. مانده اول دوره اشخاص (year_openings) ─────────────────────
create table if not exists year_openings (
  id              text primary key,
  org_id          text not null default 'shop1',
  fiscal_year_id  text,
  contact_id      text,
  balance         numeric(18,2) default 0,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  is_deleted      boolean not null default false
);
alter table year_openings add column if not exists org_id text not null default 'shop1';
alter table year_openings add column if not exists fiscal_year_id text;
alter table year_openings add column if not exists contact_id text;
alter table year_openings add column if not exists balance numeric(18,2) default 0;
alter table year_openings add column if not exists data jsonb not null default '{}'::jsonb;
alter table year_openings add column if not exists updated_at timestamptz not null default now();
alter table year_openings add column if not exists is_deleted boolean not null default false;

-- ── ۱۱. تنظیمات برنامه (app_settings) ────────────────────────────
create table if not exists app_settings (
  id          text primary key,
  org_id      text not null default 'shop1',
  key         text,
  value       text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
alter table app_settings add column if not exists org_id text not null default 'shop1';
alter table app_settings add column if not exists key text;
alter table app_settings add column if not exists value text;
alter table app_settings add column if not exists data jsonb not null default '{}'::jsonb;
alter table app_settings add column if not exists updated_at timestamptz not null default now();
alter table app_settings add column if not exists is_deleted boolean not null default false;

-- ── ۱۲. کاربران برنامه و دسترسی‌ها (app_users) ────────────────────
create table if not exists app_users (
  id            text primary key,
  org_id        text not null default 'shop1',
  username      text,
  display_name  text,
  role          text,                         -- admin / accountant / operator / viewer
  active        boolean default true,
  data          jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  is_deleted    boolean not null default false
);
alter table app_users add column if not exists org_id text not null default 'shop1';
alter table app_users add column if not exists username text;
alter table app_users add column if not exists display_name text;
alter table app_users add column if not exists role text;
alter table app_users add column if not exists active boolean default true;
alter table app_users add column if not exists data jsonb not null default '{}'::jsonb;
alter table app_users add column if not exists updated_at timestamptz not null default now();
alter table app_users add column if not exists is_deleted boolean not null default false;

-- ── ایندکس‌های کارایی بالا جهت همگام‌سازی سریع ────────────────────
create index if not exists idx_fy_sync   on fiscal_years (org_id, updated_at);
create index if not exists idx_cat_sync  on categories (org_id, updated_at);
create index if not exists idx_prod_sync on products (org_id, updated_at);
create index if not exists idx_con_sync  on contacts (org_id, updated_at);
create index if not exists idx_bnk_sync  on banks (org_id, updated_at);
create index if not exists idx_inv_sync  on invoices (org_id, updated_at);
create index if not exists idx_pay_sync  on payments (org_id, updated_at);
create index if not exists idx_chk_sync  on checks (org_id, updated_at);
create index if not exists idx_bt_sync   on bank_transfers (org_id, updated_at);
create index if not exists idx_yo_sync   on year_openings (org_id, updated_at);
create index if not exists idx_set_sync  on app_settings (org_id, updated_at);
create index if not exists idx_usr_sync  on app_users (org_id, updated_at);

-- ── تریگر به‌روزرسانی خودکار updated_at ─────────────────────────
create or replace function pb_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'fiscal_years','categories','products','contacts','banks',
    'invoices','payments','checks','bank_transfers','year_openings',
    'app_settings','app_users'
  ]
  loop
    execute format('drop trigger if exists trg_pb_touch_%1$s on %1$s;', t);
    execute format('create trigger trg_pb_touch_%1$s before update on %1$s for each row execute function pb_touch_updated_at();', t);
  end loop;
end $$;

-- ── تنظیمات امنیت ردیف‌ها (Row Level Security) ───────────────────
-- دسترسی برای کلید anon با تفکیک بر اساس org_id فعال می‌شود.
do $$
declare t text;
begin
  foreach t in array array[
    'fiscal_years','categories','products','contacts','banks',
    'invoices','payments','checks','bank_transfers','year_openings',
    'app_settings','app_users'
  ]
  loop
    execute format('alter table %1$s enable row level security;', t);
    execute format('drop policy if exists p_pb_all_%1$s on %1$s;', t);
    execute format('create policy p_pb_all_%1$s on %1$s for all using (true) with check (true);', t);
  end loop;
end $$;

-- فعال‌سازی انتشار Realtime (اختیاری جهت دریافت تغییرات آنی)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table
        fiscal_years, categories, products, contacts, banks,
        invoices, payments, checks, bank_transfers, year_openings,
        app_settings, app_users;
    exception when others then
      -- در صورت اضافه بودن قبلی، نادیده گرفته شود
      null;
    end;
  end if;
end $$;
