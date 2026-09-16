# Area block: tax, energy, procurement, family and anything else

Loaded by `/legal-kit:setup` for areas without a dedicated block. One question
group, one to two minutes. The point is to record the area honestly rather than
pretend to a depth of configuration that does not exist.

## Q1: What, and how deep

> You named [areas]. I have no dedicated configuration for these, so let me ask
> the general version rather than a fake specific one.
>
> - For each, is it your specialism or something you touch occasionally? That
>   decides how much background every answer carries.
> - Which acts do you reach for most? Name them and I will check each resolves,
>   so a later question does not fail on an act number.
> - Is there a regulator whose guidance matters as much as the statute? I mirror
>   the data protection authority and the Ministry of the Environment. For others
>   there is no mirror, and I will say so rather than quietly leaving a gap.

**Verify each named act** with `cz_act_info` while the user is present. An act
that does not resolve, or resolves to something other than what they expected, is
worth catching now.

## Notes for specific areas

**Tax.** Administrative in posture, so the administrative block's deadlines and
the Supreme Administrative Court search apply. The court's own subject terms
include *Daně - daň z přidané hodnoty*, *Daně - daň z příjmů* and *Daně -
ostatní*. There is no mirror of the tax administration's guidance.

**Public procurement.** Also administrative. The court's subject term is *Ochrana
hospodářské soutěže a veřejné zakázky*. Decisions of the competition authority
itself are not mirrored.

**Energy and regulated industries.** Act No. 458/2000 Coll. resolves by alias.
The regulator's decisions are not mirrored.

**Family.** Ordinary courts, so `cz_case_search` and the lower-court index, with
the Constitutional Court frequently decisive on the rights questions.

---

## Written to the profile

```markdown
### Other areas

| Area | Specialism or occasional | Key acts (verified) | Regulator guidance mirrored |
| --- | --- | --- | --- |
| [area] | [which] | [acts] | [no] |
```
