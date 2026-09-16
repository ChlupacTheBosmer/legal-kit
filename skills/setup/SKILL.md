---
name: setup
description: >
  Run the legal-kit cold-start interview: learns who you are, what you practise,
  where you practise it and under what supervision, then writes your profile and
  builds the local indexes. Use on first install, when the profile is missing or
  still has placeholders, or when the user says "set up legal-kit", "onboard me",
  "configure legal-kit", or wants to re-run the interview or re-check integrations.
argument-hint: "[--redo] [--redo <section>] [--full] [--check-integrations] [--areas]"
---

# /legal-kit:setup

Runs once per machine. It configures **who you are**, not what you are working
on right now; `/legal-kit:setup-project` does the second thing.

1. Read `~/.claude/plugins/config/legal-kit/profile.md`. Follow the cold-start
   check below.
2. Run the interview.
3. Write the profile. Build the indexes the user chose.
4. Show a summary, then offer a first task.

## Flags

| Flag | Does |
| --- | --- |
| *(none)* | Interview if unconfigured; otherwise report status and offer `--redo` |
| `--redo` | Re-run the whole interview, after confirming the overwrite |
| `--redo <section>` | Re-run one section, for example `--redo escalation` or `--redo areas` |
| `--full` | Skip the quick path and run the long interview |
| `--areas` | Add or remove practice areas and run only those area blocks |
| `--check-integrations` | Re-probe Zotero, Google, the registries and the indexes. No questions. |

---

# Cold-start interview: Czech and EU legal research

## Purpose

Learn how *this* lawyer works, and write it where every other skill reads it.

The stakes are specific. This toolset quotes statutes and case law into work
that someone relies on. Whether the reader is on the roll of advocates changes
what may be claimed about privilege. Whether a practice area is their specialism
or something they touch twice a year changes how much doctrinal background every
answer must carry. Whether they supervise or are supervised changes who has to
see a draft before it leaves. A generic profile produces confident output
calibrated for nobody.

## Cold-start check

Read `~/.claude/plugins/config/legal-kit/profile.md`:

- **Missing** → start the interview.
- **Contains `<!-- SETUP PAUSED AT: -->`** → greet the user, name the section
  they stopped at, and offer to resume. Never re-ask an answered question.
- **Contains `[PENDING]` markers** → same as paused: offer to fill them.
- **Contains `[PLACEHOLDER]` markers, no pause comment** → the template was
  written but never completed. Offer to resume from the first placeholder.
- **Populated** → report what is configured and stop, unless a flag says otherwise.

The section scaffold is `references/profile-template.md`. Create parent
directories as needed.

## Install scope

If the working directory is inside a project rather than the user's home
directory, say once:

> This looks like it is running inside a project. That is fine, but the profile
> this writes is global: it lives in `~/.claude/plugins/config/legal-kit/` and
> applies to every project. The per-project settings are a separate command,
> `/legal-kit:setup-project`, which you run inside each matter.

## Before the first question

Show the fork-first preamble. Four lines, no more.

> **legal-kit is for Czech and EU legal work read from the official registries.**
> It quotes the provision, names the consolidated version, and links the
> government's own page. If you need United States law, this is the wrong tool
> and it will say so rather than improvise.
>
> **Three minutes** gets you your role, your standing, your practice areas and
> the fast index, with sensible defaults everywhere else.
> **Twenty minutes** adds your supervision and escalation model, per-area
> configuration for everything you actually practise, your citation and
> drafting house style, and every index built.
>
> Quick or full? You can upgrade any time with `/legal-kit:setup --full`.

Wait for the answer before showing anything else.

Then orient them, once:

> This writes a plain-text profile that every legal-kit skill reads before it
> answers anything. Everything in it can be changed later, by re-running this or
> by editing the file.
>
> It is built only from what you type here and from documents you choose to show
> me. It does not read your other Claude conversations, your home-directory
> `CLAUDE.md`, or anything else on this machine. If something relevant is already
> visible in our conversation, I will ask before using it.
>
> If you need to stop, say "pause" and I will save your progress and pick up here
> next time.

## Interview conduct

These rules bind the whole interview.

**Assume it is already written down somewhere.** For anything longer than a
sentence (a firm's practice description, an escalation matrix, a style guide, a
retainer, a template), ask for a link, a path or a paste before asking anyone to
type it from memory. "Paste it, give me a path, or give me the short version" is
the default ask.

**Two or three answerable prompts per turn, counting subparts.** One question
with five subparts is five questions. The test is whether the user can answer
without scrolling.

**Wait for real answers.** When a question needs typing rather than picking, say
"this one needs a typed answer, I will wait", and then wait. Do not stack the
next question on top of it.

**Verify legal facts as they are stated, with the tools.** This interview runs
inside a workspace that can read the actual statute, and it should. When the
user cites a provision, a deadline, a threshold or an act number, call
`legal_cite` before writing it into the profile. If the text does not say what
they said, show them the wording and ask which goes in:

> You said the time limit is X. `§ 72(1) of Act No. 150/2002 Coll.` reads: "[the
> actual sentence]". That is Y. Which should go in the profile?

A wrong fact written into the profile propagates into every future answer. This
is the cheapest moment to catch it, and no other setup gets to check.

**Never write a silent gap.** Before writing the profile, list every question
that was skipped or defaulted and ask whether to fill any now. A `[PLACEHOLDER]`
must be a decision the user made, never a question that scrolled past.

**Pause and resume.** On "pause", "stop" or "later", write the partial profile
with `<!-- SETUP PAUSED AT: <section> -->` at the top and `[PENDING]` on
unanswered fields, and say how to resume.

---

## Part 0: Who is using this

Three questions. They change how every answer is framed, not what the tools can
reach.

### 0.1 Standing

> Who will be using this day to day?
>
> 1. **Advocate on the roll of the Czech Bar Association (Česká advokátní komora, ČAK)**
> 2. **Qualified lawyer, not on the roll** — in-house, public sector, academic, or qualified and not practising as an advocate
> 3. **Concipient, trainee or paralegal** working under an advocate's supervision
> 4. **Law student**
> 5. **Not legally qualified** — you handle legal questions as part of another job
> 6. **Something else** — tell me and I will adapt

This is the single most consequential answer in the interview. Record it and act
on it:

**If 1 (advocate).** Privilege and the duty of confidentiality under § 21 of Act
No. 85/1996 Coll., on the legal profession, attach to you. Outputs can be framed
as advice. Ask the conflicts question in Part 2 and take it seriously.

**If 2, 3, 4 or 5.** Say once, and never repeat it on every output:

> Two things change. First, nothing here is privileged: § 21 of Act No. 85/1996
> Coll. attaches the duty of confidentiality to the advocate, and Czech law has
> no attorney work product doctrine, because it has no United States style
> discovery. Second, outputs are framed as research rather than as advice, and I
> will name the point at which an advocate needs to be brought in, with the
> trigger and the specialism.
>
> That is not a disclaimer bolted on. It is the difference between what this is
> good at, which is finding and quoting the law accurately, and legal judgment
> about your specific situation, which needs someone who carries the liability.

**If 4 or 5, add:** offer to keep doctrinal background in every answer rather
than assuming it, and confirm.

**If 5, add once:** the Czech Bar Association keeps a public list of advocates at
`vyhledavac.cak.cz`, searchable by specialism and region.

### 0.2 Practice setting

> Where do you practise? This sets who a draft goes to before it leaves.
>
> - **Advocacy practice, solo or small** — no internal chain; escalation means outside counsel or a specialist
> - **Larger advocacy practice** — there is a chain, and I will ask what it is
> - **In-house** — I will ask about the escalation matrix and when something goes to the business
> - **Public administration or a public body** — I will ask about the sign-off chain and any statutory constraints on what you may say
> - **Court, prosecution or other state legal body**
> - **Academia, clinic or NGO** — I will ask about supervision and any practice restrictions
> - **None of these fit** — describe it in your own words

**If the practice does not fit the boxes,** do not force it. Say:

> Tell me what you actually do, who for, in which forums, and what the work looks
> like. I will build the profile from that and skip the questions that do not
> apply.

Then build from the description and record which template fields were filled,
adapted, or deliberately left empty. A sparse true profile beats a full forced one.

### 0.3 What is connected

> legal-kit works with Zotero for commentary, Google Docs for drafting, and the
> `claude-for-legal` plugins for workflow structure. None are required: the legal
> sources are free government registries and need no account anywhere. Let me
> check what you actually have.

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs` and read its result.

**Report tested state, never configured state.** A key present in a config file
means *available*. A call that returned data means *connected*. Confusing the two
destroys trust in everything else the profile says.

- `✓` only if a call actually succeeded.
- `⚪` configured but not verified, with one line on how to confirm.
- `✗` not found, with what it costs and how to add it later.

### 0.4 Companion plugins

The same `doctor.mjs` run reports two optional plugins from the
`claude-writing-kit` marketplace. Report them honestly: each does its half of the
job better than the fallback bundled here, and legal-kit delegates when they are
present.

**If both are installed,** say so in one line and move on.

**If either is missing,** offer it once, with what it actually adds, and do not
push:

> Two optional plugins would improve how work leaves this workspace. Neither is
> needed for research.
>
> - **gdocs-kit**: delivers a draft to a Google Doc and revises it from reviewer
>   comments, updating the existing Doc so its comment threads and share links
>   survive a new version. For anything reviewed more than once, that history is
>   the record of what was agreed and when. legal-kit has a fallback, but it
>   cannot update a Doc in place.
> - **zotero-kit**: reads and writes a Zotero library, pushes references without
>   creating duplicates, and renders a bibliography in any citation style. Useful
>   for commentary; legislation and case law are cited as links instead.
>
> ```
> /plugin marketplace add ChlupacTheBosmer/claude-writing-kit
> /plugin install gdocs-kit@claude-writing-kit
> /plugin install zotero-kit@claude-writing-kit
> ```
>
> Install them later and re-run `/legal-kit:setup --check-integrations`.

**Do not install anything yourself.** Show the lines and let the user decide;
installing a plugin into someone's account is theirs to run.

**If a credential exists in one family's location but not the other's,** say so,
because it is the confusing case: a Google token at `~/.claude_google_token.json`
and gdocs-kit looking in `~/.claude/writing-kit/google_token.json` means one of
them works and the other reports nothing. legal-kit reads both. Point out that
`GOOGLE_TOKEN_PATH` makes gdocs-kit read the existing one rather than authorising
again.

Close with: "None of this blocks anything. Re-run
`/legal-kit:setup --check-integrations` after you connect or install something."

---

## Part 1: Jurisdiction and areas

### 1.1 Jurisdiction

> Czech law within the European Union framework is the default and the only thing
> the sources cover properly. Two questions:
>
> - Do you also work with Slovak, German, Austrian or Polish law, even just for
>   comparison? I will flag when a question crosses into one, since the registries
>   here do not cover it.
> - Does anything you do touch the European Court of Human Rights, or international
>   instruments like the Aarhus Convention? Those are outside the tools and I will
>   say so rather than guess.

Record honestly. This drives a refusal, not a capability: the profile tells later
skills when to stop and name the gap.

### 1.2 Practice areas

> Which of these do you actually work in? Pick as many as apply.
>
> 1. Administrative law and judicial review
> 2. Environmental
> 3. Construction, planning and land use
> 4. Data protection and privacy
> 5. Intellectual property
> 6. Information technology, artificial intelligence and digital regulation
> 7. Commercial contracts
> 8. Corporate
> 9. Employment
> 10. Civil obligations, property, liability
> 11. Civil procedure and enforcement
> 12. Criminal
> 13. Tax and levies
> 14. Energy and regulated industries
> 15. Public procurement
> 16. Family
> 17. Something else

Then, separately:

> Of those, which are your actual specialism, and which do you touch occasionally
> without being a specialist?

**Why both questions.** The second one is what decides how much doctrinal
background every answer carries. Somebody who does environmental law daily does
not want the standing rules restated; somebody who meets them twice a year does.
Record the split explicitly.

### 1.3 Per-area configuration

For each area the user selected, load and run the matching block from
`areas/` in this skill's directory:

| Area | File |
| --- | --- |
| Administrative law and judicial review | `areas/administrative.md` |
| Environmental | `areas/environmental.md` |
| Construction, planning and land use | `areas/construction.md` |
| Data protection and privacy | `areas/data-protection.md` |
| Intellectual property | `areas/ip.md` |
| Information technology, AI and digital regulation | `areas/tech-ai.md` |
| Commercial contracts, corporate, employment | `areas/commercial.md` |
| Civil obligations, procedure, enforcement | `areas/civil.md` |
| Criminal | `areas/criminal.md` |
| Tax, energy, procurement, family, other | `areas/other.md` |

**On the quick path,** run only the block for the first-named specialism, and
mark the rest `[DEFAULT]`.

**On the full path,** run every selected block. Tell the user how many are
coming so the length is not a surprise: "You picked four areas. That is four
short blocks, two or three questions each."

Each block writes its own subsection of the profile. A block that the user skips
is recorded as `[SKIPPED: <area>]` so later skills know the difference between
"configured as default" and "never asked".

---

## Part 2: How you work

Full path only. On the quick path, default all of it and say so.

### 2.1 Escalation and supervision

Shape the question by the practice setting from 0.2.

**Solo or small advocacy practice:**
> When something is outside your competence or your appetite, where does it go?
> A named specialist, a firm you refer to, or do you decline it? And what kind of
> thing triggers that?

**Larger practice, in-house, or public body:**
> Two things. Who sees a draft before it leaves, and what makes something go up
> rather than out? Give me a role or a name. Paste your escalation matrix if you
> have one written down.

**Supervised (concipient, trainee, student, clinic):**
> Who supervises you, and what must they see before it goes anywhere? Is there
> anything you are not permitted to do independently?

Record as a table of trigger and destination. This is what later skills consult
before saying "you can handle this" as opposed to "take this to X".

### 2.2 Conflicts

Ask only of advocates and larger practices.

> Do you want me to flag possible conflicts when a counterparty name comes up? I
> can check a name against a list you keep, but I have no access to your matter
> management, so this is a reminder rather than a conflicts system, and it should
> never be relied on as one.

If yes, ask where the list lives. If there is no list, record
`[CONFLICTS: reminder only, no list]`.

### 2.3 Language and deliverables

> Three questions.
>
> - Analysis, notes and our conversation: Czech or English?
> - Czech deliverables (contracts, submissions to authorities, předžalobní výzva,
>   replies to data subjects) are drafted in Czech in full, never translated from
>   an English draft. Is that right for you?
> - Quoted provisions always stay in their own language. A translation is never
>   presented as the text. Any objection?

The second and third are stated as defaults to confirm rather than open
questions, because departing from them produces work that fails on delivery.

### 2.4 Citation and house style

> The defaults are: every cited provision carries its text, the instrument named
> in full on first mention, a link, and the version date. Abbreviations expanded
> on first use. No em-dashes. Answers structured as a report, sources before
> argument.
>
> Anything you want different? Most people say no. If your firm has a citation
> style or a template, paste it and I will record the departures.

Record only departures from the defaults, never the defaults themselves.

---

## Part 3: Sources and indexes

> Most sources are read live and need nothing from you. Three have no usable
> search interface, so legal-kit keeps a local mirror. They live in
> `~/.legal-kit/data` and are shared by every project on this machine, so this is
> the only time you build them.

Present the real cost honestly, and let the answers depend on the areas picked
in 1.2:

| Index | Build | Refresh | Matters most for |
| --- | --- | --- | --- |
| ÚOOÚ guidance | seconds | monthly | data protection |
| District and regional courts, civil and criminal | minutes per year | quarterly | civil, commercial, criminal |
| MŽP guidance and the Věstník | **hours** | quarterly | environmental, administrative |

> The Ministry of the Environment asks for ten seconds between requests and
> legal-kit honours it, which is the whole reason that one is slow. It resumes if
> interrupted, and it can run in the background while you work.

Recommend by area rather than asking three flat questions:

- Data protection selected → build ÚOOÚ now, it takes seconds.
- Environmental or administrative selected → offer the MŽP build in the background.
- Civil, commercial or criminal selected → ask how far back the lower-court index
  should reach, defaulting to the last full year.
- None of the above → say the indexes can wait, and that `/legal-kit:update`
  builds them whenever.

Run the builds the user accepts. For a background build, say how to check on it
(`/legal-kit:status`).

Then offer the refresh schedule:

> A stale mirror of a regulator is worse than none, because it looks current.
> Want a weekly job that refreshes whatever has gone stale? It does nothing in
> the weeks when nothing has.

---

## Part 4: Seed documents

Full path only. Offer, do not insist.

> Two optional things, and they teach me more than anything you can tell me.
>
> - **A piece of your own written work**: a memo, an opinion, a submission. I will
>   read it for structure, register and citation habits, and match them. Paste it,
>   give me a path, or skip.
> - **A template or precedent you reuse**: a contract, a standard letter. I will
>   record its structure so drafts start from your shape rather than a generic one.
>
> Skip either and I will note the gap rather than guessing.

If given a document, read it, extract structure and citation style, show what you
found, and confirm before recording. Never infer a house style silently from one
document.

---

## Closing

1. **Review the gaps.** List every skipped or defaulted item. Ask whether to fill
   any now. Wait.
2. **Write** `~/.claude/plugins/config/legal-kit/profile.md` from
   `references/profile-template.md`.
3. **Mirror the jurisdiction rules** into
   `~/.claude/plugins/config/claude-for-legal/company-profile.md` if that
   directory exists, so the American plugins read the Czech corrections. Say so.
4. **Summarise** in six lines or fewer: standing, setting, areas, language,
   indexes built or pending, integrations live.
5. **Offer a first task**, chosen from their first-named area. For example, for
   administrative law: "Try me: ask what the time limit is for an action against
   an administrative decision, and check that I quote § 72 rather than summarise
   it."
6. **Point at the next step**: "Run `/legal-kit:setup-project` inside a matter or
   a research project to configure that workspace. This profile applies
   everywhere and does not need repeating."

## `--check-integrations`

Run `scripts/doctor.mjs`, update the `## Integrations` and `## Indexes` sections
of the profile, and report what changed. Ask nothing else.
