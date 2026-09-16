---
name: setup-project
description: >
  Configure legal-kit for the project you are standing in: what this workspace is
  for, whose matter it is, which areas are live here, what gets produced and in
  what language, and how confidential it is. Writes the project CLAUDE.md and
  scaffolds the knowledge base. Use when starting a new matter or research
  project, when the user says "set up this project", "configure this matter", or
  when legal-kit skills run in a project with no project configuration.
argument-hint: "[--redo] [--minimal] [--vault] [--no-vault]"
---

# /legal-kit:setup-project

Runs inside a project, once per project. It configures **what you are working
on**; `/legal-kit:setup` configures who you are, globally, and is a prerequisite.

## Before anything

Read `~/.claude/plugins/config/legal-kit/profile.md`.

- **Missing** → say so and stop:

  > There is no global profile yet, and this interview builds on it: it needs to
  > know your standing and your practice areas before it can ask anything useful
  > about this project. Run `/legal-kit:setup` first. Three minutes.

- **Present** → read it, and do not re-ask anything it answers. Confirm in one
  line: "You are [standing], practising [areas], working in [language]. This is
  about this project, not about you."

Then read `./.legal-kit/project.md`:

- **Missing** → run the interview.
- **Present, no `--redo`** → report what is configured and stop.
- **Paused** → resume from the marked section.

## Flags

| Flag | Does |
| --- | --- |
| *(none)* | Interview if unconfigured |
| `--redo` | Re-run, after confirming the overwrite |
| `--minimal` | Only Q1 and Q2, defaults elsewhere, no scaffolding |
| `--vault` / `--no-vault` | Force the knowledge-base decision without asking |

---

# The interview

Shorter than the global one on purpose. Four groups, five minutes.

Open with:

> This configures the workspace, not you. What it is for, whose it is, what comes
> out of it and in what language. Five minutes, and it writes a `CLAUDE.md` here
> that every session in this folder reads.

## Q1: What is this workspace

> What is this?
>
> 1. **A matter for a client** — a live case or transaction
> 2. **A matter for my employer** — in-house work, no external client
> 3. **Standing research** — a knowledge base on a subject, not tied to one matter
> 4. **A single question** — you want an answer and a record of it, nothing more
> 5. **Teaching or study**
> 6. **Something else**

Then:

> Give me one sentence on what it is actually about. That sentence goes at the top
> of the project file and is what orients every future session in two seconds.

**If 4 (single question):** offer to skip the rest.

> For a single question you do not need the rest of this. I can write a minimal
> project file and you can just ask. Set it up properly later if it grows.

## Q2: Whose, and how confidential

**If 1 or 2:**

> - Who is the client or the business unit? A name is enough. If it is a company
>   and you want, I can check it in the business register and record the IČO and
>   who may sign, which saves a lookup later.
> - Is there a counterparty I should know about?

**If the user names a company, offer `cz_company_search`** and record the IČO and
the registered acting rules. Do not do it silently: say what you are checking.

Then, for every project type:

> How confidential is this?
>
> - **Client-confidential** — I will keep names out of anything that leaves the
>   project folder, and flag before writing anything shareable
> - **Internal**
> - **Open** — teaching material, published research, nothing sensitive

**If client-confidential and the global profile says the user is not on the ČAK
roll,** say once:

> Noted. One thing worth being clear about, once: nothing here is privileged.
> The duty under § 21 of Act No. 85/1996 Coll. attaches to the advocate. Keeping
> it confidential is a practice decision, and a sound one, but it is not
> privilege and should not be relied on as such if the file is ever demanded.

## Q3: Which areas are live here

> Your profile says you practise [areas from the global profile]. Which of those
> does *this* project actually touch?

**Why ask when the profile already knows.** A litigator with five practice areas
has one project about one of them. Narrowing here is what stops every answer
carrying background from four irrelevant areas.

> Anything live here that is not in your profile? If so I will add it to the
> project file, and you can add it globally later with `/legal-kit:setup --areas`.

**If an area is named that the global profile lists as "occasional, not
specialist",** note it in the project file: answers in this project carry the
fuller doctrinal background.

## Q4: What comes out of it

> Two questions.
>
> - What will you actually produce here? Memos and analysis, contracts or other
>   Czech-language instruments, submissions to a court or authority, notes for
>   yourself, teaching material?
> - In which language? Your profile says analysis in [language]. Czech
>   deliverables are drafted in Czech in full regardless, so this is about the
>   analysis and the notes.

**If submissions to a court or authority are named,** say once:

> Submissions carry deadlines and formal requirements that a draft cannot infer.
> I will flag the time limit at the top whenever one is running, and name what I
> cannot verify.

## Q5: The knowledge base

Skip on `--minimal`.

> Do you want an Obsidian-style knowledge base in this project? It is plain
> markdown and needs no particular editor. It gives you somewhere for notes that
> outlive the question that prompted them, with templates and a handbook.
>
> - **Yes, full** — folders, templates, the handbook, and a worked example
> - **Yes, minimal** — folders and templates, no handbook
> - **No** — answers stay in the conversation and in whatever files you make

If yes, copy from `${CLAUDE_PLUGIN_ROOT}/templates/`:

| Source | Destination |
| --- | --- |
| `vault-README.md` | `vault/README.md` |
| `vault-notes/` | `vault/90-Templates/` |
| `vault-handbook/` | `vault/50-Handbook/` (full only) |
| `Researching Czech environmental law.md` | `vault/40-Playbooks/` (full only, and only if environmental or administrative is live here) |

Create the empty folders `00-Inbox`, `10-Topics`, `20-Instruments`, `30-Memos`,
`40-Playbooks`, `_attachments`.

Then offer the work-product scaffolding, but only for areas actually live here:

- data protection live → offer `privacy/` from `templates/scaffold-privacy.md`
- commercial or corporate live → offer `contracts/`
- AI or technology live → offer `ai-governance/`

## Closing

1. **Review gaps.** Anything skipped, listed, and offered once more.
2. **Write `./.legal-kit/project.md`** from the template below.
3. **Write or update `./CLAUDE.md`** in the project root. If one exists, do not
   overwrite it: append a clearly marked block and say so.
4. **Write `./.gitignore`** entries if the project is a git repository, covering
   `.legal-kit/`, `vault/00-Inbox`, `10-Topics`, `20-Instruments`, `30-Memos`,
   and any work-product folders created. Ask before touching an existing
   `.gitignore`.
5. **Summarise in four lines**: what this is, whose, which areas, what it produces.
6. **Offer a first task** drawn from the areas live here.

---

## What goes in `./CLAUDE.md`

Keep it short. It is read at the start of every session in this folder, so it
carries the project facts and points at the rest rather than repeating it.

```markdown
<!-- legal-kit: written by /legal-kit:setup-project on YYYY-MM-DD -->

# [One sentence on what this project is]

Czech and EU legal research. The rules, the sourcing discipline and the answer
format come from the legal-kit plugin; your profile is at
`~/.claude/plugins/config/legal-kit/profile.md`. This file holds only what is
true of *this* project.

- **Type:** [client matter | in-house matter | standing research | study]
- **Client or business unit:** [name] [IČO, if checked]
- **Counterparty:** [name, or none]
- **Confidentiality:** [client-confidential | internal | open]
- **Live areas:** [areas]
- **Produces:** [deliverable types]
- **Analysis language:** [Czech | English]
- **Knowledge base:** [vault/ | none]

[If any live area is outside the user's specialism:]
Set out doctrinal background in [areas], which are outside the specialism.

[If deliverables include submissions:]
Flag time limits at the top of any answer where one is running.

[If client-confidential:]
Keep client and counterparty names out of anything written outside this folder.
[If not on the ČAK roll:] Nothing here is privileged.

Full project configuration: `.legal-kit/project.md`.
```

## What goes in `./.legal-kit/project.md`

The long form: everything asked, everything skipped, and the state of the
scaffolding. Same marker discipline as the global profile (`[PLACEHOLDER]`,
`[PENDING]`, `[DEFAULT]`), and the same rule that a legal fact carries
`[verified YYYY-MM-DD]` or `[user-stated, unverified]`.
