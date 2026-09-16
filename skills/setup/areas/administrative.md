# Area block: administrative law and judicial review

Loaded by `/legal-kit:setup` when the user selects administrative law.
Three question groups. Two to three minutes.

## Why this block exists

Czech administrative law is where the split between the two court systems bites
hardest, and getting it wrong is silent. The ordinary courts decide civil and
criminal matters; the administrative courts review what public authorities do.
A perfectly phrased Czech query about a permit returns nothing from the ordinary
courts, and that nothing looks exactly like "there is no case law".

This block configures which side of that line the user stands on, which
authorities they deal with, and which deadlines must be flagged on sight.

## What it drives

| Answer | Changes |
| --- | --- |
| Which side (challenger / authority / advisor) | Whose position every answer is written from, and which deadline is the dangerous one |
| Named authorities | What `cz_nss_search` filters by, and whether ARES lookups are worth offering |
| Subject areas | The default `cz_nss_areas` terms, so searches start from the court's own vocabulary |
| Deadline sensitivity | Whether time limits are flagged at the top of every answer or only when asked |

---

## Q1: Which side of the counter

> In administrative matters, are you usually:
>
> - **Challenging a decision** — acting for the applicant, the party, or an association
> - **Defending one** — inside the authority, or advising it
> - **Both, depending on the matter**
> - **Neither, mostly advisory** — telling clients what the authority will do before it does it

Then, if challenging or both:

> Do you act for **environmental or civic associations** (spolky) whose standing
> is itself frequently contested? That changes which case law is worth surfacing
> first, because standing gets litigated before the merits do.

**Record** as `**Posture:**` in the profile's administrative subsection.

---

## Q2: Deadlines

This is the group that earns the block. Present it as a confirmation, not an
open question, and verify the provision with `legal_cite` in front of the user.

> Administrative deadlines are the failure mode that costs money, so I flag them
> at the top of any answer where one is running. The two that matter most:
>
> The general limit for an action against an administrative decision is **two
> months** from notification, unless a special statute says otherwise, and a
> missed one **cannot be excused**.

Call `legal_cite "§ 72 150/2002"` and show the wording, then say:

> That is § 72 of Act No. 150/2002 Coll., soudní řád správní. Paragraph 4 is the
> part people get caught by: "Zmeškání lhůty pro podání žaloby nelze prominout."
>
> And a cassation complaint to the Supreme Administrative Court runs **two weeks**
> from service of the regional court's judgment.

Then ask:

> Two questions:
>
> - Are there sectoral deadlines in your work that differ from the general rule?
>   Name the act and I will check the wording now rather than later.
> - Do you want time limits flagged on every answer that touches a decision, or
>   only when you ask?

**If the user names a sectoral deadline, call `legal_cite` on it before writing
it in.** If the text disagrees with what they said, show the sentence and ask
which goes in the profile. This is the highest-leverage verification in the whole
interview: a wrong deadline in the profile becomes a wrong deadline in every
answer that reads it.

**Record** the confirmed deadlines as a table of act, provision, period and what
it runs from. Mark each `[verified <date>]` or `[user-stated, unverified]`.

---

## Q3: Authorities and subjects

> Which authorities do you deal with most? Ministries, krajské úřady, obecní úřady
> s rozšířenou působností, inspectorates, regulators. Names are fine.

> And which of the Supreme Administrative Court's own subject areas are yours? I
> can list them if it helps.

If the user wants the list, call `cz_nss_areas` and show the ones plausibly
relevant rather than all 81. The court's vocabulary includes, among others:
*Životní prostředí - ochrana přírody a krajiny*, *Životní prostředí - odpady*,
*Životní prostředí - ostatní*, *Vodní právo*, *Stavební zákon*, *Právo na
informace*, *Přestupky*, *Daně - ostatní*, *Pobyt cizinců*, *Ochrana hospodářské
soutěže a veřejné zakázky*, *Služební poměr*, *Zdravotnictví a hygiena*.

**Record** the chosen terms verbatim. Later searches pass them to `cz_nss_search`
as `area`, which refuses an unrecognised term rather than silently searching for
nothing, so the exact wording matters.

---

## Full path only: procedural posture

Ask these only on `--full`.

> Two more, both about what you usually need from a search.
>
> - Do you care about **first-instance regional judgments**, or only what NSS did
>   with them on cassation? Regional judgments are in the same source and are
>   often reversed, so I can include them, flag them as first instance, or leave
>   them out.
> - Does the **rozšířený senát** matter to your work? Its decisions settle
>   conflicts between three-judge chambers, so I can surface them first where
>   they exist.

Also worth asking if the posture is "challenging":

> When a decision is already final, do you work with the extraordinary remedies
> (obnova řízení, přezkumné řízení) often enough that I should check for them, or
> is that rare?

---

## Written to the profile

```markdown
### Administrative law and judicial review

**Posture:** [challenger | authority | both | advisory]
**Acts for associations whose standing is contested:** [yes | no]
**Deadline flagging:** [every relevant answer | on request]

**Deadlines in force for this practice:**

| Act | Provision | Period | Runs from | Checked |
| --- | --- | --- | --- | --- |
| Act No. 150/2002 Coll., soudní řád správní | § 72(1) | 2 months | notification of the decision | [verified YYYY-MM-DD] |
| Act No. 150/2002 Coll., soudní řád správní | § 106(2) | 2 weeks | service of the regional judgment | [verified YYYY-MM-DD] |

**Authorities:** [list]
**NSS subject areas (verbatim, for `cz_nss_search area=`):** [list]
**Include first-instance regional judgments:** [yes, flagged | cassation only]
**Surface rozšířený senát first:** [yes | no]
```

## Reminder for every later skill reading this

Administrative case law is in `cz_nss_search`, which covers the Supreme
Administrative Court and the regional courts in their administrative agenda.
`cz_case_lower_search` holds the Ministry of Justice feed, which carries the
ordinary courts' civil and criminal dockets and **no administrative justice at
all**. An empty result there is a fact about the source, never about the law.
