## The CoCo Test

### Definition

Before adding, storing, or preserving any data, process, or optimization, ask:

**“Would this be worth saving on a Tandy Color Computer cassette tape?”**

If the answer is **no**, it does not belong in the archive.

---

### Historical Context (Why This Exists)

Before hard drives, SSDs, and cloud storage, early personal computers stored data on
**magnetic cassette tapes**.

One example was the **Tandy Color Computer (CoCo)**, which saved data at speeds measured
in **hundreds of baud**. Saving or loading data could take several minutes and often failed.
If the tape glitched, the data was simply gone.

Because storage was:
- extremely limited
- slow
- fragile
- and frustrating to reload

people only saved data that was:
- genuinely important
- difficult or impossible to recreate
- worth the time and risk

You did not save everything.  
You saved **what mattered**.

The CoCo Test intentionally recreates this constraint as a design discipline for a modern
system where storage is cheap but complexity is dangerous.

---

### What Passes the CoCo Test

Data or processes that pass the CoCo Test typically:
- represent unique historical truth
- cannot be reliably reconstructed later
- are referenced by other records
- reduce ambiguity or data loss
- materially improve future understanding

Examples:
- canonical person records
- final match results
- season summaries
- official roles (player, coach, mascot, etc.)
- primary-source metadata
- documentation explaining irreversible decisions

---

### What Fails the CoCo Test

Data or processes that fail the CoCo Test typically:
- can be derived from other data
- exist only for convenience or performance
- add complexity without preserving new truth
- optimize speed at the expense of clarity
- duplicate information already recorded elsewhere

Examples:
- cached aggregates
- intermediate calculations
- UI-only state
- speculative metrics
- premature or clever optimizations

---

### How the CoCo Test Is Used

- The CoCo Test is applied during:
  - schema design
  - feature proposals
  - performance optimizations
  - data retention decisions
- A change may be rejected or reverted **even if it produces measurable performance gains**
  if it fails the CoCo Test.
- Passing the CoCo Test is required for long-term persistence.

---

### Rationale

This project prioritizes:
- durability over cleverness
- correctness over speed
- survivability over scale
- clarity over optimization

The CoCo Test exists to ensure the archive remains:
- small
- legible
- auditable
- portable
- and understandable decades into the future

If something would not have been worth saving when storage was scarce,
it probably is not worth preserving forever now.
