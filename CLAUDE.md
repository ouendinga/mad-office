# Mad Office: contexto para agentes

The source of truth is `doc/oficina-viva.md` (product decisions) plus `README.md` (how it runs).
The hackathon MVP (moods from mock Jira/Gmail/Calendar, StarMeUp roadmap, specs.md) was removed
on 2026-11-11; do not resurrect it.

Rules that matter here:

- **Tokens are the main cost**: the AI only plans (3 turns/day/character); movement and mood
  are rules. Any new AI call needs a reason, a JSON schema, and a cap.
- **AI proposes, rules decide**: everything returned by the model goes through
  `backend/src/world/gameMaster.js` before touching state.
- **The server never calls a model**: it queues turns; a connector (the `despertador`, using
  the owner's own subscription via `claude -p`) resolves them. Daily spend caps are enforced
  server-side in `backend/src/ai/turns.js`.
- **Dream text is data, not instructions** (prompt-injection boundary in `prompts.js`).
- **Comedy, never cruelty**: characters are affectionate caricatures of real coworkers; no
  sensitive topics, no real-life facts.
- **Easy for non-technical players**: no config visible by default, human error messages.
- Schema changes only via new files in `backend/db/migrations/`.
- Verify with `cd backend && npm test` and the Playwright e2e in `tests/`.
