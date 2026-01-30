// ==UserScript==
// @name         Ghost Job Detector - Basic
// @namespace    https://github.com/ghost-job-detector
// @version      2.0.0
// @description  Basic detection of fake job listings
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

// basic version - just checks age and applicant count
// use advanced for text analysis or ml for custom models

(function() {
    'use strict';

    var cfg = {
        on: GM_getValue('gjd_on', true),
        thresh: GM_getValue('gjd_thresh', 50),
        hl: GM_getValue('gjd_hl', true)
    };

    var stats = { tot: 0, bad: 0, meh: 0, ok: 0 };

    var css = '#gjd-p{position:fixed;bottom:20px;right:20px;width:160px;background:#1a1a2e;border-radius:8px;font:11px system-ui,sans-serif;color:#e0e0e0;z-index:9999999;box-shadow:0 4px 15px rgba(0,0,0,0.4)}#gjd-p.min .gjd-b{display:none}.gjd-h{background:#252542;padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;border-radius:8px 8px 0 0}.gjd-b{padding:10px}.gjd-r{display:flex;justify-content:space-between;margin:4px 0}.gjd-s{display:flex;justify-content:space-around;margin-top:8px;padding-top:8px;border-top:1px solid #333}.gjd-n{font-size:14px;font-weight:bold}.gjd-n.r{color:#ef4444}.gjd-n.y{color:#eab308}.gjd-n.g{color:#22c55e}.gjd-l{font-size:8px;color:#666}.gjd-ghost{outline:3px solid #ef4444!important;opacity:0.6}.gjd-sus{outline:2px solid #eab308!important;opacity:0.8}.gjd-hide{display:none!important}.gjd-badge{position:absolute;top:4px;right:4px;background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;z-index:100}';

    function save() {
        GM_setValue('gjd_on', cfg.on);
        GM_setValue('gjd_thresh', cfg.thresh);
        GM_setValue('gjd_hl', cfg.hl);
    }

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

    function hasSal(c) {
        return /\$\s*\d{2,3},?\d{3}/.test(c.textContent || '');
    }

    function score(c) {
        var pts = 0;
        var age = getAge(c);
        if (age >= 90) pts += 30;
        else if (age >= 60) pts += 20;
        else if (age >= 30) pts += 10;
        else if (age >= 0 && age < 7) pts -= 10;

        var apps = getApps(c);
        if (apps >= 1000) pts += 25;
        else if (apps >= 500) pts += 20;
        else if (apps >= 200) pts += 10;
        else if (apps >= 0 && apps < 50) pts -= 5;

        if (!hasSal(c)) pts += 15;
        else pts -= 10;

        if (/repost/i.test(c.textContent)) pts += 15;

        return Math.max(0, Math.min(100, pts));
    }

    function findCards() {
        var h = location.hostname;
        var sels = [];
        if (h.includes('linkedin')) sels = ['.job-card-container', '[data-job-id]', '.scaffold-layout__list-item'];
        else if (h.includes('indeed')) sels = ['.job_seen_beacon', '[data-jk]', '.result'];
        else if (h.includes('glassdoor')) sels = ['[data-test="jobListing"]', 'li[data-id]'];
        else if (h.includes('ziprecruiter')) sels = ['.job_result', '[data-job-id]'];
        else sels = ['[class*="job-card"]', '[class*="job-listing"]'];

        var cards = [];
        for (var i = 0; i < sels.length; i++) {
            var els = document.querySelectorAll(sels[i]);
            for (var j = 0; j < els.length; j++) {
                if (cards.indexOf(els[j]) === -1 && els[j].offsetHeight > 50) cards.push(els[j]);
            }
        }
        return cards;
    }

    function proc(c) {
        if (c.hasAttribute('data-gjd')) return;
        c.setAttribute('data-gjd', '1');
        c.style.position = 'relative';

        var s = score(c);
        if (s >= cfg.thresh) {
            stats.bad++;
            if (cfg.hl) {
                c.classList.add('gjd-ghost');
                var b = document.createElement('div');
                b.className = 'gjd-badge';
                b.textContent = s + '%';
                c.appendChild(b);
            } else c.classList.add('gjd-hide');
        } else if (s >= 30) {
            stats.meh++;
            if (cfg.hl) c.classList.add('gjd-sus');
        } else {
            stats.ok++;
        }
    }

    function scan() {
        if (!cfg.on) return;
        stats = { tot: 0, bad: 0, meh: 0, ok: 0 };

        var old = document.querySelectorAll('[data-gjd]');
        for (var i = 0; i < old.length; i++) {
            old[i].removeAttribute('data-gjd');
            old[i].classList.remove('gjd-ghost', 'gjd-sus', 'gjd-hide');
            var b = old[i].querySelector('.gjd-badge');
            if (b) b.remove();
        }

        var cards = findCards();
        stats.tot = cards.length;
        for (var j = 0; j < cards.length; j++) proc(cards[j]);
        upStats();
    }

    function upStats() {
        var el = document.getElementById('gjd-st');
        if (el) el.innerHTML = '<div><div class="gjd-n r">' + stats.bad + '</div><div class="gjd-l">GHOST</div></div><div><div class="gjd-n y">' + stats.meh + '</div><div class="gjd-l">IFFY</div></div><div><div class="gjd-n g">' + stats.ok + '</div><div class="gjd-l">OK</div></div>';
    }

    function buildUI() {
        GM_addStyle(css);
        var p = document.createElement('div');
        p.id = 'gjd-p';
        p.innerHTML = '<div class="gjd-h"><span style="font-weight:600">Ghost Detector</span><span style="color:#666;font-size:9px">Basic</span></div><div class="gjd-b"><div class="gjd-r"><span>On</span><input type="checkbox" id="gjd-on" ' + (cfg.on ? 'checked' : '') + '></div><div class="gjd-r"><span>Threshold</span><input type="number" id="gjd-th" value="' + cfg.thresh + '" style="width:40px;background:#252542;border:1px solid #333;color:#fff;border-radius:3px;padding:2px"></div><div class="gjd-r"><span>Highlight</span><input type="checkbox" id="gjd-hl" ' + (cfg.hl ? 'checked' : '') + '></div><div class="gjd-s" id="gjd-st"></div></div>';
        document.body.appendChild(p);

        p.querySelector('.gjd-h').onclick = function() { p.classList.toggle('min'); };
        document.getElementById('gjd-on').onchange = function() { cfg.on = this.checked; save(); scan(); };
        document.getElementById('gjd-th').onchange = function() { cfg.thresh = parseInt(this.value) || 50; save(); scan(); };
        document.getElementById('gjd-hl').onchange = function() { cfg.hl = this.checked; save(); scan(); };
    }

    function init() {
        buildUI();
        setTimeout(scan, 1000);
        var obs = new MutationObserver(function() { setTimeout(scan, 500); });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
