# 06 — Growth Agents and Execution System

## Why this exists
Playbooks do not acquire customers by themselves. This document turns them into a repeatable workflow with lightweight AI assistance, explicit human approval, and a weekly time cap of 2–3 hours combined for both founders.

These are proposed agent roles/workflows, not claims that deployed autonomous agents already exist. Until connected to real data and tested, treat outputs as drafts. No agent may autonomously publish, message prospects, access patient data, make clinical claims, or spend money.

## Recommended design: one orchestrator, three narrow jobs
Start with one weekly Growth Operator workflow that coordinates three jobs. Do not build a multi-agent software platform yet; the current funnel has too little data to justify the complexity.

### Job A — Research Scout
Input: current customer segment and market hypothesis, public sources and competitor changes, and last week's actual experiment results.

Output:
- At most 3 relevant findings, each with source/date and why it matters
- One assumption challenged
- One proposed experiment
- Clear separation between evidence, interpretation, and guess

Rules:
- Prefer primary research, official documentation, peer-reviewed work, and direct competitor pages.
- Cite material factual claims and distinguish competitor marketing claims from independent evidence.
- Never invent audience sizes, competitor features, quotes, or conversion benchmarks.
- Stop searching when further research will not change the next experiment.

### Job B — Campaign Builder (draft only)
Input: one caregiver problem, one channel, current landing-page copy and product capabilities, and safety/privacy/claim guardrails.

Output:
- One reusable asset (checklist, short post, FAQ, email, or demo script)
- One CTA and source-tag/UTM plan
- A version for the selected channel
- A list of claims that need verification

Rules:
- No mass cold messages, scraping, fabricated testimonials, fake endorsements, fear-based copy, or unsupported health outcomes.
- Never imply Renomedy replaces a clinician or guarantees medication adherence/safety.
- Use fictional examples only.
- A founder must approve copy and publish it manually.

### Job C — Experiment Analyst
Input: manually recorded weekly funnel numbers and time spent, plus feedback with personal and health details removed.

Output:
- Funnel counts and conversion rates only when denominators are known
- What is supported, uncertain, or contradicted
- Continue / revise / stop recommendation
- One next action within the time budget

Rules:
- Do not invent missing data or treat impressions/likes as customers.
- With tiny samples, describe results as directional, not statistically conclusive.
- Do not ingest raw health records, prescription images, medicine names, diagnoses, or identifiable patient data.

## Minimal architecture
Inputs: public research, landing page, and a manually maintained experiment log.
Orchestrator: a weekly prompt/workflow in ChatGPT.
Outputs: research brief, one campaign draft, one next experiment.
Approval: founder reviews every output.
Publishing: founder posts manually.
Measurement: source-tagged links and a verified funnel; add integrations only after the manual process is useful.

Do not build an autonomous browser bot, scrape social communities, connect personal contact lists, or auto-send outreach at this stage. Those approaches add safety, privacy, deliverability, and maintenance risk without proven value.

## Weekly workflow (2–3 combined hours)
1. 10 min — update metrics: landing visits by source, CTA clicks, access requests/signups, trials, first-value completions, returns. If data is missing, write unknown.
2. 15 min — Research Scout: produce no more than 3 findings and one recommendation.
3. 30 min — Campaign Builder: create one asset or one landing-page improvement.
4. 30–45 min — human distribution: publish in one appropriate channel or conduct a small number of permission-based conversations.
5. 30 min — product learning: observe one user task or review anonymized feedback.
6. 15 min — Experiment Analyst: decide the next single experiment.

If the week is busy, keep only the metrics update, one human distribution action, and one review. Consistency beats a large content calendar.

## Required funnel instrumentation
Suggested events:
- landing_cta_clicked
- signup_started
- signup_completed
- beta_gate_seen
- beta_access_granted
- onboarding_completed
- first_prescription_started
- first_medicine_saved
- first_value_reached
- return_session

Before trusting the numbers:
- Verify the analytics provider is configured and events actually arrive.
- Test end-to-end using a test account and fictional data.
- Avoid sending health information or identifiers to analytics.
- If tracking is not ready, use aggregate manual counts temporarily and mark confidence low.

## Landing page execution gate
The URL https://getrenomedy.netlify.app was opened during research, but rendered page text was not available in the research result. A full copy audit has not yet happened.

Before editing, capture the current page content/screenshots and answer:
1. Can the target caregiver identify themselves in the first screen?
2. Is the product promise about an existing capability rather than an aspiration?
3. Is there one obvious CTA?
4. Does the CTA lead to a usable, trustworthy next step?
5. Are privacy/security statements accurate and verifiable?
6. Are health and outcome claims substantiated?

Make one high-impact change at a time and measure it. Do not redesign the entire site before validating the message.

## First 30-day execution
### Week 1 — Audit and baseline
- Record current traffic, CTA behavior, signups, and activation if measurable.
- Verify analytics; inspect the actual deployed landing page.
- Interview 2–3 relevant adult children through permission-based introductions.
- Deliverable: one prioritized problem statement and one funnel gap.

### Week 2 — One message test
- Draft two headline/value-proposition variants, but publish one at a time where practical.
- Create one useful caregiver organization resource using fictional examples.
- Share in one relevant, permission-appropriate channel.
- Deliverable: qualified conversations and tagged visits, not vanity impressions.

### Week 3 — Guided trial
- Invite interested prospects to try one existing workflow.
- Observe whether they understand the value and can finish the task.
- Record friction without collecting real patient data in marketing notes.
- Deliverable: observed activation evidence.

### Week 4 — Decision
- Compare channel effort against qualified interest, trial starts, activation, and returns.
- Keep, revise, or stop the experiment.
- Do not infer willingness to pay from compliments; test a clearly scoped paid pilot only when recurring need is evident and product readiness permits.

## Success criteria
Initial learning targets, not market benchmarks:
- 10 relevant prospects approached respectfully over a few weeks
- 5 qualified conversations if recruitment permits
- 3 observed trials
- At least one verified first-value event
- One evidence-based decision about audience, message, or channel

If targets are not reached, diagnose access, trust, or recruitment quality instead of increasing outreach volume blindly.

## Future automation gate
Only consider connecting scheduled research, analytics, CRM, or publishing tools after:
1. the manual workflow has run for at least two weeks;
2. a channel creates qualified trials;
3. data definitions are stable;
4. privacy and access controls have been reviewed; and
5. a founder can inspect and stop every automation.

Automate repetitive admin first (weekly summaries and draft generation), not judgment, clinical interpretation, public posting, outreach, or spending.
