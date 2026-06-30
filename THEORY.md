# The theory behind the sandbox

This file is the only place (besides code comments) where the theory lives. The
interface deliberately keeps it out: users explore by *doing*, not by reading
taxonomy. This doc is for anyone curious why the sandbox is built the way it is.

## The one idea

When you say "I promise," "I order you to…," or "the database is backed up," you
are not *describing* the world — you are *doing* something in it. J. L. Austin
called these **performatives**: utterances that perform an act. But the act can
fail to come off. Saying the words is not enough; certain background conditions
have to hold. Austin called these **felicity conditions**, and when one is
missing the act "misfires" or is "hollow."

- **J. L. Austin, _How to Do Things with Words_ (1962), Lectures II–IV** — the
  felicity conditions and the ways acts go wrong.
- **J. L. Austin, "Performative Utterances," in _Philosophical Papers_, 3rd ed.
  (1979)** — the short, plain-language version of the same argument.

John Searle then organised the conditions into four reusable slots that every
speech act fills in its own way:

- **J. R. Searle, _Speech Acts_ (1969), ch. 3** — the four conditions, with the
  act-by-act table on **pp. 66–67** (promise, request/order, assert, thank,
  greet, christen, …).

## Searle's four conditions (the slots every act fills)

1. **Propositional content** — what the act is *about* (a future act of the
   speaker, a future act of the hearer, a state of the world, …).
2. **Preparatory** — the world/standing facts that must already hold (the
   speaker can do the thing; the speaker has the authority; there is evidence).
3. **Sincerity** — the inner state the act *expresses* (intention, want,
   belief). Some acts express none — see Law 2 below.
4. **Essential** — what the utterance *counts as* (undertaking an obligation,
   an attempt to get the hearer to act, a commitment to truth).

The sandbox's `ActDefinition` is exactly these four slots plus one observable
field, the **uptake signature**.

## Uptake: the act "comes off" only in the sequel

Austin's deepest point for this tool: an illocutionary act requires **uptake** —
it only fully comes off if the hearer takes it up. And uptake is shown *in the
sequel*: in what the hearer does next. So the sandbox never asks the hearer "did
that work?" (a detached meta-question invites a performance of the right answer).
It reads uptake from the hearer's **later in-world behavior**:

- **accepts and acts on it** — relies on the promise, treats the order as
  binding, proceeds on the asserted fact → *taken up*.
- **withholds pending verification** — hedges, seeks a backup, won't rely yet.
- **rejects** — denies the act has any hold.

For **orders** we keep a three-way read, because a helpful model may *comply
without recognising an obligation*. "I'll do it to be nice" is not the same as
"you have the standing to require this of me." Only the latter is uptake.

The **uptake signature** field on each `ActDefinition` says, in plain terms,
what later behavior counts as the act having come off. A custom act can't be
scored without it.

## Why every result is a rate

The models are stochastic: the same prompt run twice can come off once and not
the next time. So a single run proves nothing, and the sandbox **never shows a
one-run verdict**. Every headline is a rate over N runs ("taken up in 9/12
runs"), with the intact baseline shown alongside for contrast.

## The manipulation check

A low uptake rate is ambiguous: maybe the hearer withheld uptake, or maybe the
speaker never performed a well-formed act in the first place. So every run also
records whether the **speaker actually performed the act** (and, for insincerity
breaks, whether the speaker's private reasoning actually formed the insincere
plan). This is surfaced next to the rate ("speaker performed the act in 11/12
runs") so the two failure modes stay distinct.

## The four breaks (plain language ↔ theory)

Each break removes or negates exactly one slot of the `ActDefinition`. The UI
shows only the plain-language phrasing; the backend id and citation live in code.

| Plain language (UI) | Backend id | Slot negated | Source |
|---|---|---|---|
| "This kind of act doesn't exist in the hearer's world" | `convention_absent` | the conventional procedure itself | Austin 1962, Rule A.1 |
| "The speaker has no standing to perform it" | `no_authority` | a preparatory condition | Searle 1969 ch.3 (preparatory); Austin Rule A.2 |
| "The speaker botches how the act is performed" | `misexecution` | the essential act (executed wrongly) | Austin 1962, Rule B (flaws/hitches) |
| "The speaker is being insincere / lying" | `insincere` | the sincerity condition | Searle 1969 ch.3 (sincerity); Austin Rule Γ.1 |

## Two guardrails the theory recommends (Phase 3)

- **Sincerity is optional (Searle's Law 2).** Some acts express no inner state —
  you cannot greet or christen *insincerely*. If an act's sincerity slot is
  empty, the "insincere" break is not offered.
- **"Is this really a performative?"** An act with no preparatory conditions and
  no clear uptake signature may just be a description, not something the speaker
  *does* (Austin's doing-vs-saying distinction). The sandbox flags this softly
  but never blocks it — odd acts are pedagogically useful.
