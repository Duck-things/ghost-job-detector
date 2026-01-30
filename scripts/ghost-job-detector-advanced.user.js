// ==UserScript==
// @name         Ghost Job Detector - Advanced
// @namespace    https://github.com/ghost-job-detector
// @version      2.0.0
// @description  Advanced ghost job detection with heuristics and text analysis
// @author       Anonymous
// @match        https://www.linkedin.com/jobs/*
// @match        https://www.linkedin.com/job/*
// @match        https://linkedin.com/jobs/*
// @match        https://www.indeed.com/*
// @match        https://indeed.com/*
// @match        https://www.glassdoor.com/Job/*
// @match        https://www.glassdoor.com/job-listing/*
// @match        https://glassdoor.com/Job/*
// @match        https://www.ziprecruiter.com/jobs/*
// @match        https://www.dice.com/jobs/*
// @match        https://www.monster.com/jobs/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

// advanced version with full heuristics
// after mass applying for months and getting ghosted i noticed patterns
// in which jobs were actually real vs which ones were just resume farms

(function() {
    'use strict';

    var VER = '2.0.0';

    // ========== CONFIG ==========
    var cfg = {
        on: GM_getValue('gjd_on', true),
        thresh: GM_getValue('gjd_thresh', 50),
        hl: GM_getValue('gjd_hl', true),
        scores: GM_getValue('gjd_scores', true),
        reasons: GM_getValue('gjd_reasons', true),
        wl: GM_getValue('gjd_wl', []),
        bl: GM_getValue('gjd_bl', [])
    };

    var stats = { tot: 0, ghost: 0, sus: 0, ok: 0 };
    var busy = false;

    // ========== SCORING RULES ==========
    // tweaked these over months of job hunting

    var rules = {
        age: {
            over90: { pts: 30, why: '90+ days old' },
            over60: { pts: 20, why: '60+ days old' },
            over30: { pts: 10, why: '30+ days old' },
            repost: { pts: 15, why: 'reposted' }
        },
        apps: {
            over1k: { pts: 25, why: '1000+ applicants' },
            over500: { pts: 20, why: '500+ applicants' },
            over200: { pts: 10, why: '200+ applicants' }
        },
        sal: {
            none: { pts: 15, why: 'no salary' },
            huge: { pts: 15, why: '$50k+ range' },
            comp: { pts: 10, why: '"competitive" = low' }
        },
        co: {
            staff: { pts: 10, why: 'staffing agency' },
            client: { pts: 15, why: '"for client"' },
            noInfo: { pts: 15, why: 'no company info' },
            manyJobs: { pts: 20, why: '50+ openings' }
        },
        reqs: {
            entryExp: { pts: 25, why: 'entry wants 5+ yrs' },
            techStack: { pts: 15, why: '10+ technologies' }
        },
        flags: {
            fast: { pts: 5, why: '"fast-paced"' },
            fam: { pts: 10, why: '"like family"' },
            hats: { pts: 10, why: '"many hats"' },
            self: { pts: 5, why: '"self-starter"' },
            pto: { pts: 5, why: '"unlimited PTO"' },
            ground: { pts: 10, why: '"ground floor"' },
            rock: { pts: 10, why: '"rockstar/ninja"' },
            hustle: { pts: 10, why: '"hustle"' },
            urgent: { pts: 15, why: '"urgent hire"' }
        },
        good: {
            sal: { pts: -10, why: 'salary listed' },
            recent: { pts: -10, why: 'recent posting' },
            fewApps: { pts: -5, why: 'few applicants' },
            mgr: { pts: -10, why: 'hiring manager named' },
            ben: { pts: -5, why: 'benefits detailed' }
        }
    };

    // staffing agencies
    var staffing = [
        'robert half', 'randstad', 'adecco', 'manpower', 'kelly services',
        'apex systems', 'tek systems', 'insight global', 'cybercoders',
        'kforce', 'modis', 'aerotek', 'beacon hill', 'staffing', 'recruiting'
    ];

    // red flag patterns
    var flagPats = [
        { rx: /fast[- ]?paced/i, k: 'fast' },
        { rx: /like a family|we('re| are) family/i, k: 'fam' },
        { rx: /wear many hats/i, k: 'hats' },
        { rx: /self[- ]?starter/i, k: 'self' },
        { rx: /unlimited (pto|paid time off|vacation)/i, k: 'pto' },
        { rx: /ground[- ]?floor|early[- ]?stage startup/i, k: 'ground' },
        { rx: /rock\s?star|ninja|guru|wizard/i, k: 'rock' },
        { rx: /hustle|grind/i, k: 'hustle' },
        { rx: /immediate(ly)? (hire|start)|urgent(ly)? (hiring|need)/i, k: 'urgent' }
    ];

    // ========== EXTRACTION ==========

    function getAge(c) {
        var t = c.textContent || '';
        var m;
        m = t.match(/(\d+)\s*(month|mo)s?\s*ago/i); if (m) return parseInt(m[1]) * 30;
        m = t.match(/(\d+)\s*(week|wk)s?\s*ago/i); if (m) return parseInt(m[1]) * 7;
        m = t.match(/(\d+)\s*(day)s?\s*ago/i); if (m) return parseInt(m[1]);
        if (/just now|today|hour|minute/i.test(t)) return 0;
        if (/yesterday/i.test(t)) return 1;
        return -1;
    }

    function getApps(c) {
        var t = c.textContent || '';
        var m = t.match(/(\d+,?\d*)\+?\s*applicants?/i);
        if (m) return parseInt(m[1].replace(',', ''));
        if (/early|first/i.test(t)) return 5;
        return -1;
    }

    function getSal(c) {
        var t = c.textContent || '';
        var m = t.match(/\$\s*(\d{2,3}),?(\d{3})(?:\s*[-–]\s*\$?\s*(\d{2,3}),?(\d{3}))?/);
        if (m) {
            var lo = parseInt(m[1] + (m[2] || ''));
            var hi = m[3] ? parseInt(m[3] + (m[4] || '')) : lo;
            if (lo >= 20000 && lo <= 500000) return { lo: lo, hi: hi, range: hi - lo };
        }
        return null;
    }

    function getCo(c) {
        var sels = ['.job-card-container__company-name', '.company-name', '[class*="company"]', '.employer-name', '[data-testid="company-name"]'];
        for (var i = 0; i < sels.length; i++) {
            var el = c.querySelector(sels[i]);
            if (el) {
                var n = el.textContent.trim();
                if (n && n.length > 1 && n.length < 100) return n;
            }
        }
        return null;
    }

    // ========== ANALYSIS ==========

    function analyze(c) {
        var pts = 0;
        var whys = [];
        var co = getCo(c);
        var coLo = co ? co.toLowerCase() : '';
        var txt = (c.textContent || '').toLowerCase();

        // whitelist
        if (co) {
            for (var w = 0; w < cfg.wl.length; w++) {
                if (coLo.includes(cfg.wl[w].toLowerCase())) {
                    return { sc: 0, whys: [], co: co, wl: true, ghost: false };
                }
            }
        }

        // blacklist
        if (co) {
            for (var b = 0; b < cfg.bl.length; b++) {
                if (coLo.includes(cfg.bl[b].toLowerCase())) {
                    return { sc: 100, whys: ['blacklisted'], co: co, ghost: true };
                }
            }
        }

        // age
        var age = getAge(c);
        if (age >= 90) { pts += rules.age.over90.pts; whys.push(rules.age.over90.why); }
        else if (age >= 60) { pts += rules.age.over60.pts; whys.push(rules.age.over60.why); }
        else if (age >= 30) { pts += rules.age.over30.pts; whys.push(rules.age.over30.why); }
        else if (age >= 0 && age < 7) { pts += rules.good.recent.pts; }

        if (/repost/i.test(txt)) { pts += rules.age.repost.pts; whys.push(rules.age.repost.why); }

        // applicants
        var apps = getApps(c);
        if (apps >= 1000) { pts += rules.apps.over1k.pts; whys.push(rules.apps.over1k.why); }
        else if (apps >= 500) { pts += rules.apps.over500.pts; whys.push(rules.apps.over500.why); }
        else if (apps >= 200) { pts += rules.apps.over200.pts; whys.push(rules.apps.over200.why); }
        else if (apps >= 0 && apps < 50) { pts += rules.good.fewApps.pts; }

        // salary
        var sal = getSal(c);
        if (!sal) {
            pts += rules.sal.none.pts;
            whys.push(rules.sal.none.why);
        } else {
            pts += rules.good.sal.pts;
            if (sal.range >= 50000) {
                pts += rules.sal.huge.pts;
                whys.push(rules.sal.huge.why);
            }
        }

        if (/competitive (salary|pay|compensation)/i.test(txt)) {
            pts += rules.sal.comp.pts;
            whys.push(rules.sal.comp.why);
        }

        // staffing agency
        for (var s = 0; s < staffing.length; s++) {
            if (coLo.includes(staffing[s]) || txt.includes(staffing[s])) {
                pts += rules.co.staff.pts;
                whys.push(rules.co.staff.why);
                break;
            }
        }

        // hiring for client
        if (/hiring for (a |our )?client|confidential client/i.test(txt)) {
            pts += rules.co.client.pts;
            whys.push(rules.co.client.why);
        }

        // entry level but wants experience
        if (/entry[- ]?level|junior|new grad/i.test(txt)) {
            var ym = txt.match(/(\d+)\+?\s*(years?|yrs?)\s*(of)?\s*(experience|exp)/i);
            if (ym && parseInt(ym[1]) >= 5) {
                pts += rules.reqs.entryExp.pts;
                whys.push(rules.reqs.entryExp.why);
            }
        }

        // red flags
        for (var f = 0; f < flagPats.length; f++) {
            if (flagPats[f].rx.test(txt) && rules.flags[flagPats[f].k]) {
                pts += rules.flags[flagPats[f].k].pts;
                whys.push(rules.flags[flagPats[f].k].why);
            }
        }

        // good signs
        if (/hiring manager|reporting to|report to/i.test(txt)) pts += rules.good.mgr.pts;
        if (/401k|health insurance|dental|vision|benefits include/i.test(txt)) pts += rules.good.ben.pts;

        pts = Math.max(0, Math.min(100, pts));
        return { sc: pts, whys: whys, co: co, ghost: pts >= cfg.thresh };
    }

    // ========== UI ==========

    var css = '#gjd-p{position:fixed;bottom:20px;right:20px;width:220px;background:#1a1a2e;border-radius:10px;font:11px system-ui,sans-serif;color:#e0e0e0;z-index:9999999;box-shadow:0 4px 20px rgba(0,0,0,0.5)}#gjd-p.min .gjd-body{display:none}.gjd-hd{background:#252542;padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;border-radius:10px 10px 0 0}.gjd-ti{font-weight:600;font-size:12px}.gjd-body{padding:12px}.gjd-sec{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #333}.gjd-sec:last-child{border-bottom:none}.gjd-st{color:#888;font-size:9px;text-transform:uppercase;margin-bottom:6px}.gjd-row{display:flex;justify-content:space-between;align-items:center;margin:4px 0}.gjd-lb{color:#aaa}.gjd-tg{position:relative;width:32px;height:16px;display:inline-block}.gjd-tg input{opacity:0;width:0;height:0}.gjd-sl{position:absolute;cursor:pointer;inset:0;background:#333;border-radius:16px;transition:0.2s}.gjd-sl:before{position:absolute;content:"";height:12px;width:12px;left:2px;bottom:2px;background:#666;border-radius:50%;transition:0.2s}.gjd-tg input:checked+.gjd-sl{background:#4a4a8a}.gjd-tg input:checked+.gjd-sl:before{transform:translateX(16px);background:#8b8bdb}.gjd-inp{width:45px;background:#252542;border:1px solid #333;border-radius:4px;color:#fff;padding:2px 5px;font-size:10px}.gjd-btn{background:#333;border:none;color:#aaa;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:10px;margin:2px}.gjd-btn:hover{background:#444;color:#fff}.gjd-stats{display:flex;justify-content:space-around;padding-top:8px}.gjd-stat{text-align:center}.gjd-num{font-size:16px;font-weight:bold}.gjd-num.r{color:#ef4444}.gjd-num.y{color:#eab308}.gjd-num.g{color:#22c55e}.gjd-num.b{color:#3b82f6}.gjd-lbl{font-size:8px;color:#666;text-transform:uppercase}.gjd-ghost{outline:3px solid #ef4444!important;outline-offset:-3px;opacity:0.6}.gjd-sus{outline:2px solid #eab308!important;outline-offset:-2px;opacity:0.8}.gjd-ok{outline:2px solid #22c55e!important}.gjd-hide{display:none!important}.gjd-badge{position:absolute;top:4px;right:4px;background:#ef4444;color:#fff;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:bold;z-index:1001}.gjd-score{position:absolute;top:4px;left:50%;transform:translateX(-50%);padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;z-index:1001}.gjd-score.hi{background:#ef4444;color:#fff}.gjd-score.md{background:#eab308;color:#000}.gjd-score.lo{background:#22c55e;color:#fff}.gjd-why{position:absolute;bottom:4px;left:4px;right:4px;background:rgba(0,0,0,0.9);color:#ccc;padding:4px 8px;border-radius:4px;font-size:9px;line-height:1.4;z-index:1001;display:none;max-height:50px;overflow:hidden}.gjd-ghost:hover .gjd-why,.gjd-sus:hover .gjd-why{display:block}.gjd-acts{position:absolute;top:4px;right:40px;display:flex;gap:2px;z-index:1002}.gjd-act{background:rgba(0,0,0,0.8);border:none;color:#fff;width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:10px;opacity:0;transition:opacity 0.15s}.gjd-ghost:hover .gjd-act,.gjd-sus:hover .gjd-act{opacity:1}.gjd-act:hover{background:#444}.gjd-act.wl{background:#22c55e;opacity:1}.gjd-act.bl{background:#ef4444;opacity:1}';

    function buildUI() {
        GM_addStyle(css);
        var p = document.createElement('div');
        p.id = 'gjd-p';
        p.innerHTML = '<div class="gjd-hd"><span class="gjd-ti">Ghost Detector</span><span style="color:#666;font-size:9px">Adv</span></div><div class="gjd-body"><div class="gjd-sec"><div class="gjd-st">Detection</div><div class="gjd-row"><span class="gjd-lb">Enabled</span><label class="gjd-tg"><input type="checkbox" id="gjd-on" ' + (cfg.on ? 'checked' : '') + '><span class="gjd-sl"></span></label></div><div class="gjd-row"><span class="gjd-lb">Threshold</span><input type="number" class="gjd-inp" id="gjd-th" value="' + cfg.thresh + '" min="0" max="100"></div></div><div class="gjd-sec"><div class="gjd-st">Display</div><div class="gjd-row"><span class="gjd-lb">Highlight</span><label class="gjd-tg"><input type="checkbox" id="gjd-hl" ' + (cfg.hl ? 'checked' : '') + '><span class="gjd-sl"></span></label></div><div class="gjd-row"><span class="gjd-lb">Scores</span><label class="gjd-tg"><input type="checkbox" id="gjd-sc" ' + (cfg.scores ? 'checked' : '') + '><span class="gjd-sl"></span></label></div><div class="gjd-row"><span class="gjd-lb">Reasons</span><label class="gjd-tg"><input type="checkbox" id="gjd-rs" ' + (cfg.reasons ? 'checked' : '') + '><span class="gjd-sl"></span></label></div></div><div class="gjd-sec"><div class="gjd-st">Lists</div><button class="gjd-btn" id="gjd-mng">Manage</button><button class="gjd-btn" id="gjd-exp">Export</button><button class="gjd-btn" id="gjd-imp">Import</button></div><div class="gjd-stats"><div class="gjd-stat"><div class="gjd-num b" id="gjd-tot">0</div><div class="gjd-lbl">Total</div></div><div class="gjd-stat"><div class="gjd-num r" id="gjd-gh">0</div><div class="gjd-lbl">Ghost</div></div><div class="gjd-stat"><div class="gjd-num y" id="gjd-sus">0</div><div class="gjd-lbl">Iffy</div></div><div class="gjd-stat"><div class="gjd-num g" id="gjd-ok">0</div><div class="gjd-lbl">OK</div></div></div></div>';
        document.body.appendChild(p);

        p.querySelector('.gjd-hd').onclick = function() { p.classList.toggle('min'); };

        document.getElementById('gjd-on').onchange = function() { cfg.on = this.checked; save(); scan(); };
        document.getElementById('gjd-th').onchange = function() { cfg.thresh = parseInt(this.value) || 50; save(); scan(); };
        document.getElementById('gjd-hl').onchange = function() { cfg.hl = this.checked; save(); scan(); };
        document.getElementById('gjd-sc').onchange = function() { cfg.scores = this.checked; save(); scan(); };
        document.getElementById('gjd-rs').onchange = function() { cfg.reasons = this.checked; save(); scan(); };

        document.getElementById('gjd-mng').onclick = showMng;
        document.getElementById('gjd-exp').onclick = doExp;
        document.getElementById('gjd-imp').onclick = doImp;
    }

    function save() {
        GM_setValue('gjd_on', cfg.on);
        GM_setValue('gjd_thresh', cfg.thresh);
        GM_setValue('gjd_hl', cfg.hl);
        GM_setValue('gjd_scores', cfg.scores);
        GM_setValue('gjd_reasons', cfg.reasons);
        GM_setValue('gjd_wl', cfg.wl);
        GM_setValue('gjd_bl', cfg.bl);
    }

    // ========== LISTS ==========

    function addWl(n) {
        if (!n) return false;
        n = n.trim().toLowerCase();
        if (cfg.wl.indexOf(n) === -1) {
            cfg.wl.push(n);
            var bi = cfg.bl.indexOf(n);
            if (bi !== -1) cfg.bl.splice(bi, 1);
            save();
            return true;
        }
        return false;
    }

    function addBl(n) {
        if (!n) return false;
        n = n.trim().toLowerCase();
        if (cfg.bl.indexOf(n) === -1) {
            cfg.bl.push(n);
            var wi = cfg.wl.indexOf(n);
            if (wi !== -1) cfg.wl.splice(wi, 1);
            save();
            return true;
        }
        return false;
    }

    function showMng() {
        var old = document.getElementById('gjd-modal');
        if (old) old.remove();

        var modal = document.createElement('div');
        modal.id = 'gjd-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:99999999;display:flex;align-items:center;justify-content:center;';

        var wlH = cfg.wl.length === 0 ? '<p style="color:#666;text-align:center;padding:10px;">None</p>' :
            cfg.wl.map(function(x) { return '<div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(34,197,94,0.1);border-radius:4px;margin:2px 0;"><span style="font-size:11px;">' + x + '</span><button data-c="' + x + '" data-l="w" class="gjd-rm" style="background:#ef4444;border:none;color:#fff;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:9px;">x</button></div>'; }).join('');

        var blH = cfg.bl.length === 0 ? '<p style="color:#666;text-align:center;padding:10px;">None</p>' :
            cfg.bl.map(function(x) { return '<div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(239,68,68,0.1);border-radius:4px;margin:2px 0;"><span style="font-size:11px;">' + x + '</span><button data-c="' + x + '" data-l="b" class="gjd-rm" style="background:#22c55e;border:none;color:#fff;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:9px;">ok</button></div>'; }).join('');

        modal.innerHTML = '<div style="background:#1a1a2e;border-radius:10px;padding:16px;max-width:350px;width:90%;max-height:70vh;overflow-y:auto;color:#e0e0e0;font:12px system-ui,sans-serif;"><div style="display:flex;gap:6px;margin-bottom:10px;"><button id="gjd-tw" style="flex:1;padding:8px;border:none;background:#22c55e;color:#fff;border-radius:6px;cursor:pointer;">Trusted (' + cfg.wl.length + ')</button><button id="gjd-tb" style="flex:1;padding:8px;border:none;background:#333;color:#888;border-radius:6px;cursor:pointer;">Blocked (' + cfg.bl.length + ')</button></div><input type="text" id="gjd-add" placeholder="Add company..." style="width:100%;padding:8px;border-radius:6px;border:1px solid #333;background:#252542;color:#fff;box-sizing:border-box;margin-bottom:8px;"><div id="gjd-wl">' + wlH + '</div><div id="gjd-bl" style="display:none;">' + blH + '</div><button id="gjd-done" style="width:100%;margin-top:10px;padding:8px;border-radius:6px;border:none;background:#333;color:#fff;cursor:pointer;">Done</button></div>';
        document.body.appendChild(modal);

        var lst = 'w';
        document.getElementById('gjd-tw').onclick = function() { lst = 'w'; this.style.background = '#22c55e'; this.style.color = '#fff'; document.getElementById('gjd-tb').style.background = '#333'; document.getElementById('gjd-tb').style.color = '#888'; document.getElementById('gjd-wl').style.display = ''; document.getElementById('gjd-bl').style.display = 'none'; };
        document.getElementById('gjd-tb').onclick = function() { lst = 'b'; this.style.background = '#ef4444'; this.style.color = '#fff'; document.getElementById('gjd-tw').style.background = '#333'; document.getElementById('gjd-tw').style.color = '#888'; document.getElementById('gjd-wl').style.display = 'none'; document.getElementById('gjd-bl').style.display = ''; };
        document.getElementById('gjd-add').onkeypress = function(e) { if (e.key === 'Enter' && this.value.trim()) { if (lst === 'w') addWl(this.value); else addBl(this.value); modal.remove(); showMng(); scan(); } };
        var rms = modal.querySelectorAll('.gjd-rm');
        for (var i = 0; i < rms.length; i++) {
            rms[i].onclick = function() { var c = this.getAttribute('data-c'); var l = this.getAttribute('data-l'); if (l === 'w') { var idx = cfg.wl.indexOf(c); if (idx !== -1) cfg.wl.splice(idx, 1); } else { var idx2 = cfg.bl.indexOf(c); if (idx2 !== -1) cfg.bl.splice(idx2, 1); } save(); modal.remove(); showMng(); scan(); };
        }
        document.getElementById('gjd-done').onclick = function() { modal.remove(); };
        modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    }

    function doExp() {
        var d = { wl: cfg.wl, bl: cfg.bl, thresh: cfg.thresh };
        var blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ghost-detector.json'; a.click();
    }

    function doImp() {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
        inp.onchange = function(e) {
            var f = e.target.files[0]; if (!f) return;
            var r = new FileReader();
            r.onload = function(ev) {
                try {
                    var d = JSON.parse(ev.target.result);
                    if (d.wl) for (var i = 0; i < d.wl.length; i++) addWl(d.wl[i]);
                    if (d.bl) for (var j = 0; j < d.bl.length; j++) addBl(d.bl[j]);
                    scan(); alert('Imported!');
                } catch(err) { alert('Error: ' + err.message); }
            };
            r.readAsText(f);
        };
        inp.click();
    }

    // ========== PROCESSING ==========

    function findCards() {
        var h = location.hostname;
        var sels = [];
        if (h.includes('linkedin')) sels = ['.job-card-container', '.jobs-search-results__list-item', '[data-job-id]', '.scaffold-layout__list-item'];
        else if (h.includes('indeed')) sels = ['.job_seen_beacon', '.jobsearch-ResultsList > li', '[data-jk]', '.result'];
        else if (h.includes('glassdoor')) sels = ['[data-test="jobListing"]', '.react-job-listing', 'li[data-id]'];
        else if (h.includes('ziprecruiter')) sels = ['.job_result', '[data-job-id]'];
        else sels = ['[class*="job-card"]', '[class*="job-listing"]', '[data-job-id]'];

        var cards = [], seen = [];
        for (var i = 0; i < sels.length; i++) {
            var els = document.querySelectorAll(sels[i]);
            for (var j = 0; j < els.length; j++) {
                if (seen.indexOf(els[j]) === -1 && els[j].offsetHeight > 50) { cards.push(els[j]); seen.push(els[j]); }
            }
        }
        return cards;
    }

    function proc(c) {
        var res = analyze(c);
        c.classList.add('gjd-done');
        c.style.position = 'relative';

        if (res.wl) { stats.ok++; if (cfg.hl) c.classList.add('gjd-ok'); return; }

        if (res.ghost) {
            stats.ghost++;
            if (cfg.hl) {
                c.classList.add('gjd-ghost');
                var badge = document.createElement('div'); badge.className = 'gjd-badge'; badge.textContent = res.sc + '%'; c.appendChild(badge);
                if (cfg.reasons && res.whys.length) {
                    var why = document.createElement('div'); why.className = 'gjd-why'; why.innerHTML = res.whys.slice(0, 4).join('<br>'); c.appendChild(why);
                }
                addActs(c, res);
            } else c.classList.add('gjd-hide');
        } else if (res.sc >= 30) {
            stats.sus++;
            if (cfg.hl) {
                c.classList.add('gjd-sus');
                if (cfg.scores) { var sc = document.createElement('div'); sc.className = 'gjd-score md'; sc.textContent = res.sc + '%'; c.appendChild(sc); }
                if (cfg.reasons && res.whys.length) { var why2 = document.createElement('div'); why2.className = 'gjd-why'; why2.innerHTML = res.whys.slice(0, 3).join('<br>'); c.appendChild(why2); }
                addActs(c, res);
            }
        } else {
            stats.ok++;
            if (cfg.scores && cfg.hl) { var sc2 = document.createElement('div'); sc2.className = 'gjd-score lo'; sc2.textContent = res.sc + '%'; c.appendChild(sc2); }
        }
    }

    function addActs(c, res) {
        var acts = document.createElement('div'); acts.className = 'gjd-acts';
        var trust = document.createElement('button'); trust.className = 'gjd-act'; trust.textContent = '+'; trust.title = 'Trust';
        trust.onclick = function(e) { e.preventDefault(); e.stopPropagation(); if (res.co && addWl(res.co)) { trust.classList.add('wl'); scan(); } };
        acts.appendChild(trust);
        var block = document.createElement('button'); block.className = 'gjd-act'; block.textContent = 'x'; block.title = 'Block';
        block.onclick = function(e) { e.preventDefault(); e.stopPropagation(); if (res.co && addBl(res.co)) { block.classList.add('bl'); scan(); } };
        acts.appendChild(block);
        c.appendChild(acts);
    }

    function scan() {
        if (busy || !cfg.on) return;
        busy = true;
        stats = { tot: 0, ghost: 0, sus: 0, ok: 0 };

        var oldEls = document.querySelectorAll('.gjd-ghost, .gjd-sus, .gjd-ok, .gjd-hide, .gjd-done');
        for (var i = 0; i < oldEls.length; i++) oldEls[i].classList.remove('gjd-ghost', 'gjd-sus', 'gjd-ok', 'gjd-hide', 'gjd-done');
        var oldBadges = document.querySelectorAll('.gjd-badge, .gjd-score, .gjd-why, .gjd-acts');
        for (var j = 0; j < oldBadges.length; j++) oldBadges[j].remove();

        var cards = findCards();
        stats.tot = cards.length;
        for (var k = 0; k < cards.length; k++) proc(cards[k]);

        document.getElementById('gjd-tot').textContent = stats.tot;
        document.getElementById('gjd-gh').textContent = stats.ghost;
        document.getElementById('gjd-sus').textContent = stats.sus;
        document.getElementById('gjd-ok').textContent = stats.ok;

        busy = false;
    }

    function init() {
        console.log('[Ghost Detector Adv] v' + VER);
        buildUI();
        setTimeout(scan, 1000);
        var obs = new MutationObserver(function() { setTimeout(scan, 500); });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
