# Infrastructure reference

Working starting points for the standard in `../INFRA_STANDARD.md`. Copy what a project
needs; these are meant to be edited, not imported.

| File | What it is | When to use it |
|---|---|---|
| `gitignore-fragment` | Secret and build-output ignore rules | Paste at the top of a project's `.gitignore` **before the first commit** |
| `env.example` | Environment variable names, with the public/server boundary explained | Copy in at project start, prune what the project does not use |
| `rls-starter.sql` | Default-deny row-level security schema | Copy for the first table, then follow the same shape for every table after |
| `DNS_TLS_RUNBOOK.md` | Standing up a custom domain, and what to do when the certificate stalls | Read before adding a domain, not after |

---

## Standing up a new project

1. `gitignore-fragment` into `.gitignore`. First, before anything is committed. A credential
   removed after it lands is a history rewrite, not a delete, and every existing clone keeps
   the old copy.
2. `env.example` into the project root. Fill `.env.local` locally and never commit it.
3. `rls-starter.sql` as the shape for the first migration. Enable RLS in the same migration
   that creates the table, never a later one.
4. Commit the hosting config and build command. If the only record of how the project
   deploys is a dashboard, it cannot be rebuilt or handed over.
5. `DNS_TLS_RUNBOOK.md` when the domain goes on.

---

## Checking a project that already exists

Worth running against something you believe is fine. All four of these have been found true
of live, working projects in this studio.

- **Is there any deploy configuration in the repository at all?** A site can serve correctly
  for months with its entire configuration in a host's console.
- **Are there two vendors doing one job?** List the platform SDKs in the dependency file and
  ask what each is for. Two overlapping answers is the signal.
- **Is anything sensitive untracked but *unignored*?** Untracked is not safe. It means one
  `git add -A` from permanent. Only ignored is safe.
- **Does the repository have a remote?** A commit with nowhere to go buys integrity but not
  durability, and surviving the machine is most of the point.
