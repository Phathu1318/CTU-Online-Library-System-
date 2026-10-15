create type public.app_role as enum ('staff', 'student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- First account becomes staff, everyone else student
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'staff') then
    insert into public.user_roles (user_id, role) values (new.id, 'staff');
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  subject text not null default 'General',
  description text not null default '',
  published_year int,
  format text not null default 'physical' check (format in ('physical','digital','both')),
  total_copies int not null default 1 check (total_copies >= 0),
  available_copies int not null default 1 check (available_copies >= 0),
  file_path text,
  cover_color text not null default 'forest',
  created_at timestamptz not null default now()
);
grant select on public.books to anon, authenticated;
grant insert, update, delete on public.books to authenticated;
grant all on public.books to service_role;
alter table public.books enable row level security;
create policy "anyone can browse" on public.books for select to anon, authenticated using (true);
create policy "staff insert" on public.books for insert to authenticated with check (public.has_role(auth.uid(),'staff'));
create policy "staff update" on public.books for update to authenticated using (public.has_role(auth.uid(),'staff'));
create policy "staff delete" on public.books for delete to authenticated using (public.has_role(auth.uid(),'staff'));

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  book_id uuid not null references public.books(id) on delete cascade,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '14 days'),
  returned_at timestamptz
);
grant select on public.loans to authenticated;
grant all on public.loans to service_role;
alter table public.loans enable row level security;
create policy "own loans or staff" on public.loans for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'staff'));

create table public.saved_books (
  user_id uuid not null,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
grant select, insert, delete on public.saved_books to authenticated;
grant all on public.saved_books to service_role;
alter table public.saved_books enable row level security;
create policy "own saved select" on public.saved_books for select to authenticated using (auth.uid() = user_id);
create policy "own saved insert" on public.saved_books for insert to authenticated with check (auth.uid() = user_id);
create policy "own saved delete" on public.saved_books for delete to authenticated using (auth.uid() = user_id);

create or replace function public.borrow_book(_book_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if exists (select 1 from loans where user_id = auth.uid() and book_id = _book_id and returned_at is null) then
    raise exception 'You already have this book on loan';
  end if;
  if (select count(*) from loans where user_id = auth.uid() and returned_at is null) >= 5 then
    raise exception 'You can have at most 5 books on loan';
  end if;
  update books set available_copies = available_copies - 1
    where id = _book_id and available_copies > 0 and format in ('physical','both');
  if not found then raise exception 'No copies available right now'; end if;
  insert into loans (user_id, book_id) values (auth.uid(), _book_id);
end; $$;

create or replace function public.return_book(_loan_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _book uuid;
begin
  update loans set returned_at = now()
    where id = _loan_id and returned_at is null
      and (user_id = auth.uid() or public.has_role(auth.uid(),'staff'))
    returning book_id into _book;
  if _book is null then raise exception 'Loan not found'; end if;
  update books set available_copies = least(total_copies, available_copies + 1) where id = _book;
end; $$;

revoke execute on function public.borrow_book(uuid) from anon, public;
revoke execute on function public.return_book(uuid) from anon, public;
grant execute on function public.borrow_book(uuid) to authenticated;
grant execute on function public.return_book(uuid) to authenticated;

insert into public.books (title, author, subject, description, published_year, format, total_copies, available_copies, cover_color) values
('Introduction to Algorithms', 'Cormen, Leiserson, Rivest & Stein', 'Computer Science', 'The classic reference on algorithm design and analysis.', 2022, 'both', 4, 4, 'forest'),
('Clean Code', 'Robert C. Martin', 'Computer Science', 'A handbook of agile software craftsmanship.', 2008, 'physical', 3, 3, 'clay'),
('Database System Concepts', 'Silberschatz, Korth & Sudarshan', 'Computer Science', 'Foundations of database design, SQL and transactions.', 2019, 'physical', 2, 2, 'ink'),
('Computer Networking: A Top-Down Approach', 'Kurose & Ross', 'Networking', 'How the internet works, layer by layer.', 2021, 'both', 3, 3, 'ochre'),
('Network+ Guide to Networks', 'Jill West', 'Networking', 'Preparation for the CompTIA Network+ certification.', 2021, 'physical', 2, 2, 'forest'),
('Principles of Marketing', 'Kotler & Armstrong', 'Business', 'Core marketing concepts with real-world cases.', 2020, 'physical', 3, 3, 'clay'),
('Financial Accounting', 'Weygandt, Kimmel & Kieso', 'Accounting', 'Accounting principles for first-year students.', 2019, 'both', 2, 2, 'ink'),
('The Design of Everyday Things', 'Don Norman', 'Design', 'Why some products satisfy and others frustrate.', 2013, 'physical', 2, 2, 'ochre'),
('Graphic Design: The New Basics', 'Ellen Lupton', 'Design', 'Visual fundamentals: point, line, plane, rhythm, colour.', 2015, 'physical', 1, 1, 'clay'),
('Project Management: A Systems Approach', 'Harold Kerzner', 'Business', 'Planning, scheduling and controlling projects.', 2017, 'physical', 2, 2, 'forest'),
('Cybersecurity Essentials', 'Charles J. Brooks', 'Networking', 'Protecting systems, networks and data.', 2018, 'digital', 0, 0, 'ink'),
('Academic Writing for Students', 'Stephen Bailey', 'Study Skills', 'Plan, write and reference academic essays with confidence.', 2018, 'digital', 0, 0, 'ochre');