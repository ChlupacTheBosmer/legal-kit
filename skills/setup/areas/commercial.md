# Area block: commercial contracts, corporate and employment

Loaded by `/legal-kit:setup`. Three question groups, three minutes.

## Q1: Which of the three, and which side

> Which do you work on: commercial contracts, corporate, employment, or a mix?
> And are you mostly drafting your own paper, reviewing someone else's, or
> negotiating between the two?

---

## Q2: Your positions

> The thing worth capturing here is what you will and will not accept, because it
> is rarely written down and it is what makes a review useful rather than generic.
>
> Do you have a playbook, standard terms, or a fallback-positions note? Paste it
> or give me a path and I will extract the positions instead of asking twenty
> questions.

If nothing is available, ask only the four that matter most:

> - Liability: what cap do you push for, and what will you not go below?
> - What is an automatic reject, the term you will not sign whatever else is on offer?
> - Governing law and forum: what is your standard, and what will you concede?
> - Contractual penalty (smluvní pokuta): do you use it, and at what level?

**Verify anything cited.** If the user says the Civil Code requires or forbids
something specific, call `legal_cite` on the section before recording it.

---

## Q3: Language and form

> Two quick ones.
>
> - Are your contracts in Czech, English, or bilingual? Bilingual raises which
>   version prevails, and I will flag it if the draft is silent.
> - Do you need the counterparty's signing authority checked? `cz_company` returns
>   the registered acting rules and current statutory bodies from ARES, which is
>   the fast way to catch a signature that will not bind.

---

## Written to the profile

```markdown
### Commercial, corporate and employment

**Scope:** [contracts | corporate | employment | mix]
**Posture:** [own paper | reviewing | negotiating]
**Playbook:** [path, or positions captured below]
**Liability cap standard / floor:** [values]
**Automatic reject:** [term]
**Governing law and forum:** [standard / concession]
**Contractual penalty:** [used how]
**Contract language:** [Czech | English | bilingual, prevailing version]
**Check signing authority by default:** [yes | no]
```
