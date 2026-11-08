// Alle Beispielprofile: Validierung (EN/DE), Rendern im Panel und Klick auf jeden sichtbaren Button.
const fs = require('fs');
const path = require('path');
const { open, ROOT, run, wait } = require('./lib');

run(async () => {
  const T = await open(null);
  const { ev, ok } = T;
  const dir = path.join(ROOT, 'examples');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const list = Array.isArray(d.profiles) ? d.profiles : [d];
    for (const lang of ['en', 'de']) for (const p0 of list) {
      const p = JSON.parse(JSON.stringify(p0));
      const v = await ev(`(()=>{const r=MindProfiles.validate(${JSON.stringify(p)});return {ok:r.ok,errors:MindProfiles.explain(r.errors,'en')}})()`);
      ok(`${f}/${p.id}/${lang} valid`, v.ok, v.errors);
      const mid = 'TESTMIND' + (++n);
      p.mindIds = [mid]; delete p.titleMatch;
      await ev(`chrome.storage.local.set({lang:'${lang}',customProfiles:{[${JSON.stringify(p.id)}]:${JSON.stringify(p)}}});0`);
      await ev(`window.__tabs[0].url='https://venice.ai/chat/minds/local/${mid}/x';window.__tabs[0].title='t';0`);
      await ev(`(()=>{const s=document.getElementById('lang');s.value='${lang}';s.dispatchEvent(new Event('change'))})();0`);
      await wait(3600);
      const info = await ev(`(()=>{const out={logo:document.getElementById('logo').textContent,tabs:[...document.querySelectorAll('.tab')].map(t=>t.textContent),clicked:0,queue:0};
        document.querySelectorAll('.tab').forEach(tb=>{ if(tb.hidden) return; tb.click(); document.querySelectorAll('.panel:not([hidden]) .grid button').forEach(b=>{ if(!b.hidden){ b.click(); out.clicked++; } }); });
        out.queue=document.querySelectorAll('#queue li:not(.empty)').length; out.bad=/\\[object Object\\]|undefined/.test(document.body.innerText); return out; })()`);
      ok(`${f}/${p.id}/${lang} renders`, !!info.logo && info.tabs.length > 0 && info.tabs.every((t) => t.trim()) && !info.bad, info);
      ok(`${f}/${p.id}/${lang} buttons work`, info.clicked === 0 || info.queue > 0, info);
    }
  }
  T.finish();
});
