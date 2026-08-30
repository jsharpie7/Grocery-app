# Grocery App

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health

## Gemini receipt scanning (`src/lib/gemini.ts`)

Hard-won constraints. Changing any of these reintroduces a bug that took several
rounds to find, because every one of them fails *silently* rather than erroring.

**Unknown `generationConfig` keys are ignored, not rejected.** This is the trap that
caused the original outage. The code sent `thinkingConfig: { thinkingBudget: 0 }` for
months; Google retired that parameter in favour of `thinkingLevel`, the request kept
returning 200, and thinking quietly switched itself back on for every scan. Nothing in
the response says a key was dropped. So: verify parameter names against the current
docs before assuming an existing one still does anything, and never infer that a
setting works because the request succeeds.

- `thinkingLevel` is current; `thinkingBudget` is legacy. They are mutually exclusive —
  sending both is a 400. Set the level **explicitly**; thinking defaults differ per
  model (2.5-flash-lite is off, most others are on), so relying on a default means the
  behaviour changes whenever the model does.
- Receipt extraction is transcription, not reasoning. `thinkingLevel: 'low'` is correct
  on the merits, and `'low'` is the one value every model in `MODEL_CHOICES` accepts.
- Put the **text part before the image part**. Google's image-understanding guide
  specifies that ordering for a single image containing the text being read.
- Keep `maxOutputTokens` set. Without it the ceiling is ~65k, so one repetition loop
  generates for minutes and surfaces only as a timeout.
- Only re-encode an image when it is actually being resized. App receipt downloads
  arrive as crisp grayscale PNG; converting those to JPEG tripled the payload and put
  ringing artifacts on the exact text we need read.
- Scale images on **width**, not the longest edge. Receipts are tall and narrow, so the
  longest edge is the wrong axis and crushes the one that carries the text.

**Do not raise the 45s timeout.** It has been raised once already and it did not help;
a timeout is the symptom. Read the "Scan details" panel instead — it reports the build
id, image dimensions and format, prepare vs request timing, model version, finish
reason, and token counts including thinking tokens. `prepare` vs `request` separates a
device problem from a server one, and a non-zero thinking count means something
re-enabled thinking. Check the build id first: a stale cached bundle looks exactly like
a fix that did not work.
