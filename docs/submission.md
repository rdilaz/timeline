# Submission text (Meta Global AI Developer Hackathon, Indie track)

**Project name:** Timeline

**Tagline:** Your life on one page. You choose how much you share.

**One-line pitch (if the form asks for something short):**
A life timeline you make in a minute, where you choose how much to share, and Meta Llama 3.2 runs on your own device.

**Short description (one paragraph):**
Timeline puts your life on one page, from where you started to today, then on to the plans still ahead. The twist is privacy. You pick how much to share in three ways: an eight-tap quiz with no AI, a beta framework for connected apps that refuses addresses and phone numbers before anything is used, or your own words, written up by Meta Llama 3.2 running on your own device. If you want a hosted model instead, Muse Spark is one opt-in tap away, and you see exactly what is sent. It opens as a plain, simple list, and the same timeline can switch to two richer templates: an ink handscroll with generated music, and Cosmos, where each moment is a star. Nothing is stored on a server.

**How it uses Meta's models:**
- Meta Llama 3.2 1B Instruct runs in the visitor's browser through WebLLM on WebGPU, in a web worker. It turns a free-form life story into structured timeline moments (JSON) with a kanji, a time, a line and a short paragraph for each.
- Muse Spark through Meta's Model API is an opt-in alternative for devices without WebGPU. The server sends only the cleaned story and a fixed system prompt, rate limits it, and keeps no logs of what people write.
- Both use the same prompt, and both answers go through the same strict checker before anything is drawn.

**What makes it technically interesting:**
- One guard file runs in the browser and on the server. It cuts links, HTML and code, emails, phone numbers, street addresses, postal codes, ID, card and account numbers, exact dates, handles and secrets, and shows the person each cut before any model runs. It also re-checks every line a model writes.
- Three templates over one data model: Basic (a plain, readable list), Ink scroll and Cosmos (a canvas spiral of stars, with today in gold and plans as rings). Switching keeps your timeline.
- The ink scroll is drawn live: brush strokes, splatter physics, ink bleed, parallax ink-wash mountains, generated koto and bell music with the Web Audio API, and an omikuji fortune deck tied to the person's own plans.
- Fast mode for older devices: lower canvas resolution, effects off, and a small Rust library compiled to WebAssembly (SIMD) for the per-pixel paper grain and the baked mountains. The app races Rust against JavaScript on your own device and shows the result.
- Accessible: full keyboard and mouse support, visible Back and Next controls, reduced motion, plain English labels, and the default Basic template uses no Japanese at all.

**Challenges:**
Getting a 1B model to return valid, safe JSON every time. The answer is a fixed schema in the prompt, JSON mode, a tolerant extractor, a strict checker that drops bad lines rather than failing, and one retry at a lower temperature.

**What's next:**
Real Google and Microsoft connectors behind the beta framework, reading titles and years only. Bigger on-device Llama models for capable laptops. More templates, starting with a lunisolar calendar, and sharing a timeline as an image.

**Theme:** Build for Your World. It is a personal tool for looking back at your own life and planning what comes next, built so private details never have to leave your device.

**Who it's for and what problem it solves:**
Anyone who wants to see their life in one place without handing a company their history. Life and journaling apps usually ask for everything up front. Timeline asks first how much you want to share, and its strictest option works with no AI and no typing at all.

**How it fits the judging (creativity, technical ambition, whether it works):**
- Creativity: one timeline, three looks. A plain list anyone can read, a living ink handscroll with generated music, and Cosmos, where your life is a spiral of stars with today in gold.
- Technical ambition: an on-device Llama 3.2 in the browser on WebGPU, one guard file shared by browser and server that checks input and model output, and a Rust module compiled to WebAssembly for fast mode.
- It works: the quiz, the apps preview and the templates run on any modern browser, phone or desktop, with keyboard and mouse support. Llama needs WebGPU, and Muse covers devices without it.

**Built during the hackathon:** Yes. The public app, the three sharing options, the guard, the templates, fast mode and the server were all built Oct 26 to Nov 4.

**Team:** Solo (Indie track).

**X post for the Most Viral bonus (paste the post's link into the form):**
Your calendar knows your day. Your photos know your moments. Nothing knows your life.

Timeline puts your whole life on one page, down to today's to-dos. You choose what to share. Llama 3.2 runs on your device.

Demo: [video link]

What memory would you start with?

**Track:** Indie

**Links:**
- Live site: (Render address, after deploy)
- Code: (public GitHub repo, after push)
- Demo video: (after filming)
