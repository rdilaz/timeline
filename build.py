#!/usr/bin/env python3
"""Build Timeline into one HTML page.

  web/index.html      the live site (served by server/server.js): Llama loads from /vendor
  dist/artifact.html  a preview copy for claude.ai (no server, so no model downloads)

The ink scroll itself (src/base-*) is the original Timeline, minus every personal detail.
src/guard.js, src/gen.js, src/maker.js, src/fast.js and src/maker.css are the new public parts."""
import base64, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
S = lambda p: open(os.path.join(ROOT, "src", p), encoding="utf8").read()
WEBLLM_VER = "0.2.84"

def patch(text, old, new, count=1):
    n = text.count(old)
    if n != count:
        sys.exit(f"patch anchor found {n} times, wanted {count}: {old[:70]!r}")
    return text.replace(old, new)

def data():
    js = r"""
const g=require('./src/gen.js');
const m=[
 {kind:'event',chapter:'roots',when:'Childhood',kanji:'海',line:'A small town by the sea.',detail:'Salt air and a horizon that always looked like a promise.',splat:'none'},
 {kind:'event',chapter:'roots',when:'Age 9',kanji:'音',line:'A secondhand piano arrives.',detail:'Three keys stick. You learn every song anyway.',splat:'black'},
 {kind:'event',chapter:'craft',when:'High school',kanji:'工',line:'Robotics club, three years running.',detail:'Late nights, burnt fingers and one robot that finally climbed the ramp.',splat:'none'},
 {kind:'event',chapter:'craft',when:'College',kanji:'学',line:'A degree in mechanical engineering.',detail:'Gears, heat and the patience to get one thing exactly right.',splat:'red'},
 {kind:'event',chapter:'work',when:'First job',kanji:'職',line:'Fixing machines on night shifts.',detail:'The quiet hours taught you to listen to how things break.',splat:'none'},
 {kind:'event',chapter:'work',when:'Year four',kanji:'移',line:'A new city and a design job.',detail:'Boxes in a small apartment, and drawings that finally get built.',splat:'black'},
 {kind:'event',chapter:'making',when:'Weekends',kanji:'陶',line:'Pottery, badly, then well.',detail:'The wheel does not care how your week went. That is the point.',splat:'none'},
 {kind:'event',chapter:'making',when:'Last spring',kanji:'店',line:'A tiny online shop for your bowls.',detail:'Twelve sold in the first month. Every one wrapped by hand.',splat:'red'},
 {kind:'ahead',chapter:'ahead',when:'Next year',kanji:'旅',line:'Walk the Kumano Kodo.',detail:'Old pilgrim paths through the mountains, one village a day.',splat:'none'},
 {kind:'ahead',chapter:'ahead',when:'Someday',kanji:'家',line:'A workshop with a garden.',detail:'A kiln out back and tomatoes by the door.',splat:'none'}
];
const ev=g.assemble(m,'Example scroll');
ev[0].line="Mika's life, left to right."; ev[0].detail="Mika is made up. Make your own scroll next: you choose how much you share.";
ev.forEach((e,i)=>{ if(e.id.startsWith('m-')) e.id='ex-'+i; });
process.stdout.write(JSON.stringify({version:1,owner:"",chapters:g.CHAPTERS,events:ev,deck:g.buildDeck(ev)}));
"""
    d = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))
    old = json.loads(open(os.path.join(ROOT, "src", "base-data.json"), encoding="utf8").read())
    d["tiers"], d["modes"], d["cosmos"] = old["tiers"], old["modes"], old["cosmos"]
    return d

def app_js(hosted):
    a = S("base-app.js")
    a = patch(a, 'const K_EVENTS="timeline.v5.events"', 'const K_EVENTS="tlpub.v1.events"')
    a = patch(a, "let events=store.get(K_EVENTS,null)||DATA.events.map(e=>({...e}));",
              "let events=store.get(K_EVENTS,null)||DATA.events.map(e=>({...e}));\nif(store.get(K_EVENTS,null)) DATA.deck=TLGen.buildDeck(events);")
    # paper: the old one-off canvas becomes Rust grain + fibres, and fast mode lives here
    i, j = a.index("/* ============ paper fibers texture"), a.index("/* ============ the stroke: geometry")
    a = a[:i] + S("grain-js.js") + "\n" + S("fast.js") + "\n" + a[j:]
    a = patch(a, "function sizeCanvas(c,w,h,dmax=2){const d=Math.min(dmax,window.devicePixelRatio||1);",
              "function sizeCanvas(c,w,h,dmax=2){const d=FAST?Math.min(.75,window.devicePixelRatio||1):Math.min(dmax,window.devicePixelRatio||1);")
    a = patch(a, "function splash(ctx,cx,cy,R,col,seed,count=30,owner=null){",
              "function splash(ctx,cx,cy,R,col,seed,count=30,owner=null){\n  if(FAST) count=Math.ceil(count*.3);")
    a = patch(a, "  if(p.bled||!p.bleed", "  if(FAST||p.bled||!p.bleed")
    a = patch(a, "  const far=$(\"#far\"), fw=Math.ceil(W+(n-1)*W*K_FAR), d=Math.min(1.5,window.devicePixelRatio||1,4000/fw);\n",
              "  const far=$(\"#far\"), fw=Math.ceil(W+(n-1)*W*K_FAR), d=Math.min(1.5,window.devicePixelRatio||1,4000/fw);\n"
              "  if(FAST&&INK.ok){ washInto(far,fw,h); $(\"#fog\").innerHTML=\"\"; return; }\n")
    a = patch(a, '  $("#fog").style.transform=', '  if(!FAST) $("#fog").style.transform=')
    a = patch(a, "if(Math.abs(dd)>1.5||still||!p.kj) continue;", "if(Math.abs(dd)>1.5||still||FAST||!p.kj) continue;")
    a = patch(a, '<div class="crow"><button class="chip primary" type="button" data-act="play"><b aria-hidden="true">映</b>Play the scroll</button><button class="chip" type="button" data-act="cosmos"><b aria-hidden="true">宙</b>Cosmos preview</button></div>`;',
              '<div class="crow"><button class="chip primary" type="button" data-act="maker"><b aria-hidden="true">筆</b>Make your own</button><button class="chip" type="button" data-act="play"><b aria-hidden="true">映</b>Play the scroll</button></div>`;')
    a = patch(a, '  if(a==="noop") return;',
              '  if(a==="noop") return;\n  if(a==="maker"){ openMaker(); return }\n  if(a==="race"){ raceInk(); return }\n  if(a==="fastsw"){ setFast(!FAST); return }')
    a = patch(a, "Copied. Paste it to Claude to make it the new draft.", "Copied. This page keeps your scroll only in this browser, so save the copy somewhere safe.")
    i = a.index("const CREDIT=`"); j = a.index("`;", i) + 2
    a = a[:i] + "const CREDIT=" + json.dumps(CREDIT) + ";" + a[j:]
    a = patch(a, "/* ============ start + stay correct at every size", S("maker.js") + "\n" + S("tpl.js") + "\n/* ============ start + stay correct at every size")
    wasm = base64.b64encode(open(os.path.join(ROOT, "web", "ink.wasm"), "rb").read()).decode()
    url = 'new URL("vendor/web-llm-%s.js",location.href).href' % WEBLLM_VER if hosted else json.dumps("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@%s/+esm" % WEBLLM_VER)
    head = f'const HOSTED={"true" if hosted else "false"}, WEBLLM_URL={url};\nconst INK_WASM_B64="{wasm}";\n'
    return head + a

CREDIT = ("<b>Credits</b><br>Built with Llama: on-device writing uses Meta Llama 3.2 1B Instruct (Llama 3.2 Community License) through WebLLM by the MLC team (Apache 2.0). "
          "The opt-in hosted writer is Muse Spark through Meta's Model API. Paper grain and fast-mode mountains are drawn by a small Rust library compiled to WebAssembly. "
          "Type: Yuji Syuku by Kinuta Font Factory, Shippori Mincho by FONTDASU, Zen Kaku Gothic New by Yoshimichi Ohira, all via Google Fonts. "
          "Futures follow omikuji, the fortune slips of Japanese shrines and temples, including the custom of tying a slip to the rack. "
          "Mountains after sansui ink-wash painting; gold flecks after kinpaku paper. Brush, splatter and paper are drawn live in your browser, and the moon phase is worked out there too. "
          "Music and sound effects are generated live with the Web Audio API (koto by Karplus-Strong string synthesis, bells by modal synthesis, reverb from a generated impulse response), so no recordings are used. "
          "Moods use Japanese pentatonic scales: yo, in and hirajoshi. Nothing you write or tap is stored on a server.")

def body():
    b = S("base-body.html")
    b = patch(b, '<button class="tbtn edit" type="button" data-act="edit" aria-label="Edit this moment"><span class="ck" aria-hidden="true">筆</span>Edit</button>',
              '<div class="grp"><button class="tbtn make" type="button" data-act="maker"><span class="ck" aria-hidden="true">新</span>Make yours</button>'
              '<button class="tbtn edit" type="button" data-act="edit" aria-label="Edit this moment"><span class="ck" aria-hidden="true">筆</span><span class="elbl">Edit</span></button></div>')
    b = patch(b, '      <h3 class="sh">Modes</h3>',
              '      <h3 class="sh">Fast mode</h3>\n'
              '      <div class="row"><button class="switch" id="fastSwitch" type="button" data-act="fastsw" role="switch" aria-checked="false"><span class="knob" aria-hidden="true"></span>Fast mode</button></div>\n'
              '      <p class="status">Lower resolution and fewer effects for older phones and laptops.</p>\n'
              '      <div class="row"><button class="ghost" type="button" data-act="race">Race Rust against JavaScript</button></div>\n'
              '      <ul class="race" id="raceOut"></ul><p class="status" id="raceNote"></p>\n'
              '      <h3 class="sh">Your data</h3>\n'
              '      <p class="status">Your timeline lives only in this browser. Quiz answers and Llama never leave this device. Muse sends only the cleaned story you see, and nothing is kept.</p>\n'
              '      <h3 class="sh">Modes</h3>')
    b = patch(b, '<button class="tbtn fs" id="fsBtn"',
              '<button class="tbtn tplb" type="button" data-act="tplpick" aria-label="Choose a template"><span class="ck" aria-hidden="true">替</span>Templates</button>\n      <button class="tbtn fs" id="fsBtn"')
    maker = ('\n  <div class="veil" id="makerVeil" hidden>\n    <div class="sheet maker" role="dialog" aria-modal="true" aria-labelledby="mk-h">\n'
             '      <div class="mkhead"><h2 id="mk-h">Make your timeline</h2><button class="ghost" type="button" data-act="closeveil">Close</button></div>\n'
             '      <div id="mkBody"></div>\n    </div>\n  </div>\n' + S("tpl.html"))
    i = b.rindex("</div>")
    return b[:i] + maker + b[i:]

def page(hosted):
    d = data()
    style = S("base-style.css") + "\n" + S("maker.css") + "\n" + S("tpl.css")
    head = ('<title>Timeline</title>\n'
            '<meta name="description" content="Your life on one page. Make it from a quiz, a preview of your apps, or your own words written up by Llama on your device. You choose how much you share.">\n'
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@500;700&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap">\n')
    if hosted:
        head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head + '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%E5%A2%A8%3C/text%3E%3C/svg%3E">\n'
    data_tag = '<script type="application/json" id="timeline-data">\n' + json.dumps(d, ensure_ascii=False, indent=1).replace("</", "<\\/") + "\n</script>\n"
    html = (head + data_tag + "<style>\n" + style + "\n</style>\n" + ("</head>\n<body>\n" if hosted else "") + body() + "\n"
            "<script>\n" + S("demo.js") + "\n</script>\n<script>\n" + S("guard.js") + "\n</script>\n<script>\n" + S("gen.js") + "\n</script>\n"
            "<script>\n(function(){\n" + app_js(hosted) + "\n})();\n</script>\n" + ("</body>\n</html>\n" if hosted else ""))
    return html

if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    open(os.path.join(ROOT, "web", "index.html"), "w", encoding="utf8").write(page(True))
    open(os.path.join(ROOT, "dist", "artifact.html"), "w", encoding="utf8").write(page(False))
    for p in ("web/index.html", "dist/artifact.html"):
        print(p, os.path.getsize(os.path.join(ROOT, p)), "bytes")
