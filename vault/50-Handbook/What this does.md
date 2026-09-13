---
title: What this does
type: handbook
status: verified
tags: []
created: 2026-08-24
updated: 2026-08-24
---

# What this does — a guide for you

## The problem it solves

Asking an AI a legal question normally gets you a confident answer from memory.
Czech law changes several times a year, so that answer is often out of date, and
you cannot tell which parts are real.

This project makes the AI **go and read the actual text** every time, then show
you what it read. You can check every claim it makes.

## What it can look up

| What you want | Where it comes from | How good is it |
| --- | --- | --- |
| Any Czech act, in force today or on any past date | e-Sbírka, the government's official collection | **Excellent** — this is the legally authoritative text |
| Any EU regulation or directive, in 24 languages | EUR-Lex | **Excellent** — official, and it picks the amended version |
| Supreme Court decisions | The court's own database | **Very good** — full search, all published decisions |
| Constitutional Court decisions | NALUS, the court's database | **Good** — full search, but see the caveat in [[What to trust]] |
| District and regional court decisions, civil and criminal | Ministry of Justice open data | **Partial** — only 2025 onward unless we extend it, and it holds no administrative justice at all |
| What the data-protection authority has said | ÚOOÚ's published guidance, copied locally | **Very good** for GDPR questions |
| Who a company is and who can sign for it | ARES, the business register | **Excellent** |
| Supreme Administrative Court and regional administrative courts | The court's own search at vyhledavac.nssoud.cz | **Very good** — subject index, the provision applied, full text; this is where environmental, tax and building disputes are decided |
| What the Ministry of the Environment has said, and whether a resort instrument is in force | Věstník MŽP and the ministry's methodological documents, copied locally | **Very good** for environmental questions |

## What you get back

Ask a question, and you should get a **short legal report**:

1. **The question**, restated, with the facts it depends on.
2. **The short answer** — a few sentences, with how confident it is.
3. **The law, quoted.** Not "Article 4 says you need consent" but the actual
   sentence, in the original language, with a link. This is the part that lets
   you check the reasoning instead of trusting it.
4. **What it means for you**, in plain terms.
5. **What is uncertain**, and what would settle it.
6. **What to do next**, including when to call a real lawyer.

If you get an answer without quoted text, ask for it. The whole point is that
you can audit the reasoning.

## What it will not do

- **It is not a lawyer.** It cannot represent you, and it does not carry
  professional liability. For anything with money or a deadline attached, it is
  a way to arrive at your lawyer's office already informed, not a replacement.
- **It does not know your facts.** It answers the question you ask. If a detail
  matters and you did not mention it, the answer may be wrong for your case.
- **It is weak on very new questions.** If no court has ruled and no regulator
  has written, it can tell you what the text says but not how it will be applied.

## Writing things down

Answers worth keeping go into this vault as notes — see the folders
`10-Topics` (concepts), `20-Instruments` (specific laws), `30-Memos`
(answers to real questions) and `40-Playbooks` (repeatable procedures).
Templates are in `90-Templates`.

Ask the agent to "write this up as a note" and it will use the right template.
