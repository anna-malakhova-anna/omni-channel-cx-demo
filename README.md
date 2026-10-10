# Northgate Bank: channel-switch continuity demo

One AI customer-service agent working across **voice, SMS and web chat**, with identity and conversation state carried across channel switches. A customer is verified once and never asked to repeat themselves.

> **Northgate Bank is fictional and all data is synthetic.** Voice, SMS and the bank are all simulated in the browser. No telephony, no real accounts, no real bank.

## The customer problem

Customers start on the phone, get pushed to a link or an app, and have to re-identify and re-explain at every hop. When the case reaches a human, the context is gone. This demo shows the alternative: one reasoning agent, one timeline per customer, and a handoff that keeps the story intact.

## What the demo shows

1. **Voice:** Maya Chen calls, verifies (full name + last 4 of card), and describes a charge she doesn't recognize. The agent finds the $214.37 QUICKMART ONLINE charge and reads it back naturally.
2. The agent says it is texting a secure link. It **never speaks a URL**; the model doesn't even see it.
3. **SMS:** a short text with a link arrives on the fake phone.
4. **Chat:** tapping the link opens an already-authenticated chat with the voice turns in the timeline, tagged by channel. The agent picks up mid-dispute.
5. Maya adds a note. The agent summarizes and **asks for explicit confirmation** before opening the dispute (DSP-1001).
6. Maya asks for a human. The agent escalates.
7. **Agent desk:** a ticket appears with the customer, dispute status, an agent-written summary, and the full cross-channel timeline.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY and a LINK_SIGNING_SECRET
npm run dev                  # http://localhost:3000, use Chrome for voice
npm test                     # unit tests for tools and tokens
```

Script: press **Call Northgate**, then hold the button and say "Maya Chen, four four one seven." Say you don't recognize a charge of about two hundred dollars online, confirm it's the QuickMart one, and ask for a text. Tap the link in the phone, add a note, say yes, and ask for a person. **Reset demo** (top right) reseeds everything.

Other paths to try: three wrong verifications (agent locks and escalates), the link tapped twice (already used), and "demo: send an expired link" under the phone.

## Architecture

```
Browser panes: Voice · SMS · Chat · Agent desk
        │ POST /api/agent {channel, sessionToken, message}
        ▼
 Orchestrator (channel-agnostic)
   - builds system prompt = base rules + channel style + customer timeline
   - Claude tool-use loop (verify, transactions, link, dispute, escalate)
   - logs every turn to a channel-tagged timeline
        ▼
 BankRepository interface ── InMemoryRepository (seeded from data/seed.json)
```

**Where real systems plug in**

| Demo piece | Production integration |
|---|---|
| Voice pane (Web Speech API) | Telephony / CCaaS provider with streaming STT and TTS |
| SMS pane + `send_secure_link` | SMS gateway; the link is the same signed token |
| `BankRepository` | Core banking API (cards, transactions, disputes) |
| `tickets`, `escalate` | Helpdesk / CRM case creation and routing queue |
| `timeline` | Interaction store the human agent's console reads |

## Design decisions

- **Channel-agnostic orchestration.** Channel changes only two things: the style fragment in the system prompt (voice: 1–2 spoken sentences; SMS: terse; chat: rich) and how the front end renders. Tools and business logic are identical.
- **Verify once.** Verification binds a server-side session to a `customerId`. The browser only holds an opaque session id. Every account tool re-checks that the model is acting on that customer.
- **Secure links, not identity-by-phone-number.** `send_secure_link` mints an HMAC-signed token that expires in 15 minutes and works once. Invalid, expired or used tokens fall back to an unauthenticated chat that asks to verify.
- **Confirmation before consequential actions.** `open_dispute` requires the customer's confirming words, and the server checks they appear in their latest message. The prompt asks for confirmation, but the code enforces it too.
- **Failure is recoverable.** Tools return structured errors the agent can explain. Three failed verifications lock the session and the agent escalates. Error messages don't reveal whether the name or the digits were wrong.
- **Human handoff carries context.** The ticket links the dispute and includes a summary the agent wrote, plus the whole timeline. Link tokens are redacted in the desk view.

## What's mocked, and what production would need

- **Telephony** and real **SMS delivery**.
- **Authentication:** name + last 4 is a demo-grade check. A real rollout needs KYC-grade verification, step-up auth for sensitive actions, and rate limiting beyond 3 tries per session.
- **Data handling:** retention rules, PII redaction in logs and prompts, encryption, consent for call recording.
- **Persistence:** the store is in-memory and resets when the server restarts. Sessions are also in-memory.
- **Operations:** monitoring, evals for agent behaviour, prompt/model versioning, cost controls.
- **Human routing:** queues, skills-based assignment, SLAs, and a live handoff instead of a ticket follow-up.

## Known limitations

- Voice works in **Chrome only** (Web Speech API); other browsers show a notice. Digits can be misheard by speech recognition.
- Single tenant, single in-memory process, so no horizontal scaling.
- The SMS pane is hard-wired to Maya's phone, and `/api/sms` is an unauthenticated stand-in for a carrier.
- An unverified escalation creates a ticket without a customer, and the turns before verification are not stored.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Anthropic TypeScript SDK with tool use (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`), Vitest.
