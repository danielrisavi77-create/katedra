\set ON_ERROR_STOP on

\i supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql

-- A project that exists only in shared Core must not be claimable through the
-- legacy compatibility write-path by another user.
insert into public.academic_projects(
  id, user_id, work_type, topic
) values (
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-4000-8000-000000000001',
  'graduate',
  'shared-only owner A'
);

do $$
begin
  begin
    insert into public.katedra_projects(
      user_id, project_id, guest_project_id, work_type, work_type_canonical, topic
    ) values (
      '00000000-0000-4000-8000-000000000002',
      '44444444-4444-4444-8444-444444444444',
      '44444444-4444-4444-8444-444444444444',
      'd', 'graduate', 'attempted owner B takeover'
    );
    raise exception 'expected shared project ownership conflict was not raised';
  exception
    when unique_violation then null;
  end;
end $$;

-- The failed compatibility write must not alter the canonical owner.
do $$
begin
  if not exists (
    select 1 from public.academic_projects
    where id = '44444444-4444-4444-8444-444444444444'
      and user_id = '00000000-0000-4000-8000-000000000001'
      and topic = 'shared-only owner A'
  ) then
    raise exception 'ownership conflict changed shared project owner or metadata';
  end if;
end $$;

-- Project-scoped entitlements must belong to the same user as the project.
do $$
begin
  begin
    insert into public.entitlements(
      user_id, project_id, scope, capabilities, source_product_id
    ) values (
      '00000000-0000-4000-8000-000000000002',
      '44444444-4444-4444-8444-444444444444',
      'academic-pass',
      array['lekta.recheck'],
      'invalid-cross-user-pass'
    );
    raise exception 'expected entitlement project-owner violation was not raised';
  exception
    when foreign_key_violation then null;
  end;
end $$;

-- The correct owner can receive a project-scoped entitlement.
insert into public.entitlements(
  user_id, project_id, scope, capabilities, source_product_id
) values (
  '00000000-0000-4000-8000-000000000001',
  '44444444-4444-4444-8444-444444444444',
  'academic-pass',
  array['lekta.recheck'],
  'valid-owner-pass'
);

do $$
begin
  if not exists (
    select 1 from public.entitlements
    where user_id = '00000000-0000-4000-8000-000000000001'
      and project_id = '44444444-4444-4444-8444-444444444444'
      and source_product_id = 'valid-owner-pass'
  ) then
    raise exception 'valid owner entitlement was not persisted';
  end if;
end $$;

select 'ACADEMIC_SUITE_DB_HARDENING_PASS' as status;
