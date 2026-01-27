// ==UserScript==
// @name         Ghost Job Detector
// @namespace    https://github.com/achyutsharma/ghost-job-detector
// @version      1.0.0
// @description  Spot fake and ghost job listings on LinkedIn, Indeed, Glassdoor and more
// @author       Achyut Sharma
// @match        https://www.linkedin.com/jobs/*
// @match        https://www.linkedin.com/job/*
// @match        https://linkedin.com/jobs/*
// @match        https://linkedin.com/job/*
// @match        https://www.indeed.com/*
// @match        https://indeed.com/*
// @match        https://www.glassdoor.com/Job/*
// @match        https://www.glassdoor.com/job-listing/*
// @match        https://glassdoor.com/Job/*
// @match        https://www.ziprecruiter.com/jobs/*
// @match        https://ziprecruiter.com/jobs/*
// @match        https://www.dice.com/jobs/*
// @match        https://www.monster.com/jobs/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

/*
 * Ghost Job Detector v1.0.0
 * By Achyut Sharma
 * 
 * Detects suspicious job listings that are likely fake or "ghost" jobs.
 * Companies post these to farm resumes, look like they're growing, or
 * just never bother to take them down after hiring someone.
 * 
 * GitHub: https://github.com/achyutsharma/ghost-job-detector
 */

(function() {
    'use strict';

    const VERSION = '1.0.0';

    // ==================== CONFIG ====================
    const CONFIG = {
        enabled: GM_getValue('enabled', true),
        showScores: GM_getValue('showScores', true),
        showReasons: GM_getValue('showReasons', true),
        highlightMode: GM_getValue('highlightMode', true),
        
        ghostThreshold: GM_getValue('ghostThreshold', 50),
        
        hideNoSalary: GM_getValue('hideNoSalary', false),
        hideOldJobs: GM_getValue('hideOldJobs', true),
        oldJobDays: GM_getValue('oldJobDays', 60),
        hideHighApplicants: GM_getValue('hideHighApplicants', false),
        maxApplicants: GM_getValue('maxApplicants', 500),
        
        companyWhitelist: GM_getValue('companyWhitelist', []),
        companyBlacklist: GM_getValue('companyBlacklist', []),
        
        debug: false
    };

    const stats = {
        total: 0,
        flagged: 0,
        suspicious: 0,
        clean: 0
    };

    // ==================== DETECTION RULES ====================
    // Spent way too long tweaking these numbers. They're based on
    // patterns I noticed after months of job hunting.
    
    const RULES = {
        age: {
            over90Days: { score: 30, reason: 'Posted 90+ days ago' },
            over60Days: { score: 20, reason: 'Posted 60+ days ago' },
            over30Days: { score: 10, reason: 'Posted 30+ days ago' },
            reposted: { score: 15, reason: 'Reposted listing' },
            repostedMultiple: { score: 25, reason: 'Reposted multiple times' }
        },

        applicants: {
            over1000: { score: 25, reason: '1000+ applicants but still open' },
            over500: { score: 20, reason: '500+ applicants' },
            over200: { score: 10, reason: '200+ applicants' }
        },

        salary: {
            notListed: { score: 15, reason: 'No salary listed' },
            hugeRange: { score: 15, reason: 'Salary range is $50K+ wide' },
            competitivePay: { score: 10, reason: '"Competitive salary" usually means low' },
            doeOnly: { score: 10, reason: 'DOE without any range' }
        },

        requirements: {
            entryLevelSenior: { score: 25, reason: 'Entry level but wants 5+ years exp' },
            unrealisticStack: { score: 20, reason: 'Wants 10+ different technologies' },
            phdForNothing: { score: 10, reason: 'PhD required for non-research role' }
        },

        company: {
            noInfo: { score: 20, reason: 'No company information' },
            staffingAgency: { score: 10, reason: 'Staffing agency posting' },
            hiringForClient: { score: 15, reason: '"Hiring for client" - less accountable' },
            tooManyOpenings: { score: 20, reason: '50+ openings (resume farming?)' }
        },

        description: {
            tooShort: { score: 15, reason: 'Description under 100 words' },
            noTeamInfo: { score: 10, reason: 'No team or manager mentioned' },
            noSpecifics: { score: 10, reason: 'No specific responsibilities' },
            buzzwordOverload: { score: 15, reason: 'Too many buzzwords, no substance' }
        },

        redFlags: {
            fastPaced: { score: 5, reason: '"Fast-paced" = overworked' },
            family: { score: 10, reason: '"Like a family" = no boundaries' },
            manyHats: { score: 10, reason: '"Wear many hats" = understaffed' },
            selfStarter: { score: 5, reason: '"Self-starter" = no support' },
            unlimitedPto: { score: 5, reason: '"Unlimited PTO" usually means less' },
            groundFloor: { score: 10, reason: '"Ground floor" = low pay, high risk' },
            rockstar: { score: 10, reason: '"Rockstar/Ninja" = bad culture' },
            hustle: { score: 10, reason: '"Hustle" = burnout' },
            urgent: { score: 15, reason: '"Urgent hire" = desperation or fake' }
        },

        goodSigns: {
            salaryListed: { score: -10, reason: 'Salary listed' },
            specificTeam: { score: -10, reason: 'Specific team mentioned' },
            recentPost: { score: -10, reason: 'Posted recently' },
            lowApplicants: { score: -5, reason: 'Reasonable applicant count' },
            benefits: { score: -5, reason: 'Benefits detailed' },
            interviewInfo: { score: -5, reason: 'Interview process described' },
            hiringManager: { score: -10, reason: 'Hiring manager named' }
        }
    };

    // These companies are staffing agencies - not bad, just often repost
    const STAFFING_AGENCIES = [
        'robert half', 'randstad', 'adecco', 'manpower', 'kelly services',
        'express employment', 'staffing', 'recruiting', 'apex systems',
        'tek systems', 'insight global', 'cybercoders', 'jobspring',
        'mondo', 'kforce', 'modis', 'talent', 'hireright'
    ];

    // Red flag phrases I've seen over and over
    const RED_FLAG_PATTERNS = [
        { regex: /fast[- ]?paced/i, key: 'fastPaced' },
        { regex: /like a family|we('re| are) family/i, key: 'family' },
        { regex: /wear many hats/i, key: 'manyHats' },
        { regex: /self[- ]?starter/i, key: 'selfStarter' },
        { regex: /unlimited (pto|paid time off|vacation)/i, key: 'unlimitedPto' },
        { regex: /ground[- ]?floor|early[- ]?stage startup/i, key: 'groundFloor' },
        { regex: /rock\s?star|ninja|guru|wizard/i, key: 'rockstar' },
        { regex: /hustle|grind/i, key: 'hustle' },
        { regex: /immediate(ly)? (hire|start)|urgent(ly)? (hiring|need)/i, key: 'urgent' },
        { regex: /competitive (salary|pay|compensation)/i, key: 'competitivePay' },
        { regex: /d\.?o\.?e\.?|depends on experience/i, key: 'doeOnly' }
    ];

    const ENTRY_LEVEL = /entry[- ]?level|junior|associate|new grad|0-2 years/i;
    const YEARS_REQUIRED = /(\d+)\+?\s*(years?|yrs?)(\s*of)?\s*(experience|exp)/gi;

    // ==================== EXTRACTION ====================

    function getJobAge(card) {
        const text = card.textContent || '';
        
        const patterns = [
            { regex: /(\d+)\s*(minute|min)s?\s*ago/i, unit: 'minutes' },
            { regex: /(\d+)\s*(hour|hr)s?\s*ago/i, unit: 'hours' },
            { regex: /(\d+)\s*(day)s?\s*ago/i, unit: 'days' },
            { regex: /(\d+)\s*(week|wk)s?\s*ago/i, unit: 'weeks' },
            { regex: /(\d+)\s*(month|mo)s?\s*ago/i, unit: 'months' },
            { regex: /just now|today/i, unit: 'today' },
            { regex: /yesterday/i, unit: 'yesterday' }
        ];

        for (const { regex, unit } of patterns) {
            const match = text.match(regex);
            if (match) {
                const num = parseInt(match[1]) || 1;
                switch (unit) {
                    case 'minutes':
                    case 'hours':
                    case 'today':
                        return { days: 0, reposted: false };
                    case 'yesterday':
                        return { days: 1, reposted: false };
                    case 'days':
                        return { days: num, reposted: false };
                    case 'weeks':
                        return { days: num * 7, reposted: false };
                    case 'months':
                        return { days: num * 30, reposted: false };
                }
            }
        }

        const reposted = /repost/i.test(text);
        return { days: null, reposted };
    }

    function getApplicants(card) {
        const text = card.textContent || '';
        const patterns = [
            /(\d+,?\d*)\+?\s*applicants?/i,
            /over\s*(\d+,?\d*)\s*applicants?/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return parseInt(match[1].replace(',', ''));
            }
        }
        return null;
    }

    function getSalary(card) {
        const text = card.textContent || '';
        const salaryMatch = text.match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?/);
        
        if (salaryMatch) {
            const rangeMatch = salaryMatch[0].match(/\$([\d,]+)\s*[-–]\s*\$([\d,]+)/);
            if (rangeMatch) {
                const low = parseInt(rangeMatch[1].replace(',', ''));
                const high = parseInt(rangeMatch[2].replace(',', ''));
                return { listed: true, range: high - low };
            }
            return { listed: true, range: null };
        }

        return { 
            listed: false, 
            competitive: /competitive (salary|pay)/i.test(text),
            doe: /d\.?o\.?e|depends on experience/i.test(text)
        };
    }

    function getCompany(card) {
        const text = card.textContent || '';
        const textLower = text.toLowerCase();
        
        const selectors = [
            '[class*="company"]', '[class*="Company"]',
            '[class*="employer"]', '[data-company]'
        ];
        
        let name = null;
        for (const sel of selectors) {
            const el = card.querySelector(sel);
            if (el?.textContent?.trim()) {
                name = el.textContent.trim().toLowerCase();
                break;
            }
        }

        const isStaffing = STAFFING_AGENCIES.some(agency => 
            textLower.includes(agency) || (name && name.includes(agency))
        );

        const forClient = /hiring for (a |our )?client|on behalf of|confidential/i.test(text);

        return { name, isStaffing, forClient, hasInfo: !!name };
    }

    function getRequirements(card) {
        const text = card.textContent || '';
        const isEntry = ENTRY_LEVEL.test(text);
        
        let maxYears = 0;
        let match;
        while ((match = YEARS_REQUIRED.exec(text)) !== null) {
            const years = parseInt(match[1]);
            if (years > maxYears) maxYears = years;
        }

        // Count tech requirements
        const techs = text.match(/\b(python|java|javascript|react|angular|node|sql|aws|azure|docker|kubernetes|terraform|git|agile|scrum)\b/gi);
        const techCount = techs ? [...new Set(techs.map(t => t.toLowerCase()))].length : 0;

        return {
            isEntry,
            yearsRequired: maxYears,
            mismatch: isEntry && maxYears >= 5,
            tooManyTechs: techCount >= 10
        };
    }

    function checkDescription(card) {
        const text = card.textContent || '';
        const words = text.split(/\s+/).length;
        
        const hasTeam = /team of|reporting to|manager|join our \w+ team/i.test(text);
        const hasSpecifics = /you will|responsibilities include|working on/i.test(text);
        const hasInterview = /interview|screening|hiring process/i.test(text);
        const hasManager = /hiring manager|recruiter:|posted by/i.test(text);
        const hasBenefits = /401k|health|dental|pto|remote|hybrid/i.test(text);

        const buzzwords = text.match(/\b(synergy|leverage|innovative|dynamic|passionate|driven|proactive|stakeholder|bandwidth|scalable|robust|disrupt|paradigm)\b/gi);
        const buzzCount = buzzwords ? buzzwords.length : 0;

        return {
            wordCount: words,
            tooShort: words < 100,
            hasTeam,
            hasSpecifics,
            hasInterview,
            hasManager,
            hasBenefits,
            tooManyBuzzwords: buzzCount >= 5
        };
    }

    // ==================== SCORING ====================

    function calculateScore(card) {
        const result = {
            score: 0,
            reasons: [],
            positives: []
        };

        const age = getJobAge(card);
        const applicants = getApplicants(card);
        const salary = getSalary(card);
        const company = getCompany(card);
        const reqs = getRequirements(card);
        const desc = checkDescription(card);
        const text = card.textContent || '';

        // Age scoring
        if (age.days !== null) {
            if (age.days >= 90) {
                result.score += RULES.age.over90Days.score;
                result.reasons.push(RULES.age.over90Days.reason);
            } else if (age.days >= 60) {
                result.score += RULES.age.over60Days.score;
                result.reasons.push(RULES.age.over60Days.reason);
            } else if (age.days >= 30) {
                result.score += RULES.age.over30Days.score;
                result.reasons.push(RULES.age.over30Days.reason);
            } else if (age.days <= 7) {
                result.score += RULES.goodSigns.recentPost.score;
                result.positives.push(RULES.goodSigns.recentPost.reason);
            }
        }

        if (age.reposted) {
            result.score += RULES.age.reposted.score;
            result.reasons.push(RULES.age.reposted.reason);
        }

        // Applicants
        if (applicants !== null) {
            if (applicants >= 1000) {
                result.score += RULES.applicants.over1000.score;
                result.reasons.push(RULES.applicants.over1000.reason);
            } else if (applicants >= 500) {
                result.score += RULES.applicants.over500.score;
                result.reasons.push(RULES.applicants.over500.reason);
            } else if (applicants >= 200) {
                result.score += RULES.applicants.over200.score;
                result.reasons.push(RULES.applicants.over200.reason);
            } else if (applicants < 50) {
                result.score += RULES.goodSigns.lowApplicants.score;
                result.positives.push(RULES.goodSigns.lowApplicants.reason);
            }
        }

        // Salary
        if (!salary.listed) {
            result.score += RULES.salary.notListed.score;
            result.reasons.push(RULES.salary.notListed.reason);
        } else {
            result.score += RULES.goodSigns.salaryListed.score;
            result.positives.push(RULES.goodSigns.salaryListed.reason);
            
            if (salary.range && salary.range > 50000) {
                result.score += RULES.salary.hugeRange.score;
                result.reasons.push(RULES.salary.hugeRange.reason);
            }
        }

        // Company
        if (!company.hasInfo) {
            result.score += RULES.company.noInfo.score;
            result.reasons.push(RULES.company.noInfo.reason);
        }
        if (company.isStaffing) {
            result.score += RULES.company.staffingAgency.score;
            result.reasons.push(RULES.company.staffingAgency.reason);
        }
        if (company.forClient) {
            result.score += RULES.company.hiringForClient.score;
            result.reasons.push(RULES.company.hiringForClient.reason);
        }

        // Requirements
        if (reqs.mismatch) {
            result.score += RULES.requirements.entryLevelSenior.score;
            result.reasons.push(RULES.requirements.entryLevelSenior.reason);
        }
        if (reqs.tooManyTechs) {
            result.score += RULES.requirements.unrealisticStack.score;
            result.reasons.push(RULES.requirements.unrealisticStack.reason);
        }

        // Description
        if (desc.tooShort) {
            result.score += RULES.description.tooShort.score;
            result.reasons.push(RULES.description.tooShort.reason);
        }
        if (!desc.hasTeam) {
            result.score += RULES.description.noTeamInfo.score;
            result.reasons.push(RULES.description.noTeamInfo.reason);
        }
        if (!desc.hasSpecifics) {
            result.score += RULES.description.noSpecifics.score;
            result.reasons.push(RULES.description.noSpecifics.reason);
        }
        if (desc.tooManyBuzzwords) {
            result.score += RULES.description.buzzwordOverload.score;
            result.reasons.push(RULES.description.buzzwordOverload.reason);
        }

        // Good signs
        if (desc.hasTeam) {
            result.score += RULES.goodSigns.specificTeam.score;
            result.positives.push(RULES.goodSigns.specificTeam.reason);
        }
        if (desc.hasInterview) {
            result.score += RULES.goodSigns.interviewInfo.score;
            result.positives.push(RULES.goodSigns.interviewInfo.reason);
        }
        if (desc.hasManager) {
            result.score += RULES.goodSigns.hiringManager.score;
            result.positives.push(RULES.goodSigns.hiringManager.reason);
        }
        if (desc.hasBenefits) {
            result.score += RULES.goodSigns.benefits.score;
            result.positives.push(RULES.goodSigns.benefits.reason);
        }

        // Red flag phrases
        for (const { regex, key } of RED_FLAG_PATTERNS) {
            if (regex.test(text) && RULES.redFlags[key]) {
                result.score += RULES.redFlags[key].score;
                result.reasons.push(RULES.redFlags[key].reason);
            }
        }

        result.score = Math.max(0, Math.min(100, result.score));
        result.company = company.name;

        return result;
    }

    // ==================== JOB ANALYSIS ====================

    function analyzeJob(card) {
        const result = {
            isGhost: false,
            score: 0,
            reasons: [],
            company: null,
            whitelisted: false,
            blacklisted: false
        };

        const analysis = calculateScore(card);
        result.score = analysis.score;
        result.reasons = analysis.reasons;
        result.company = analysis.company;

        // Check lists
        if (result.company) {
            if (CONFIG.companyWhitelist.some(c => result.company.includes(c.toLowerCase()))) {
                result.whitelisted = true;
                return result;
            }
            if (CONFIG.companyBlacklist.some(c => result.company.includes(c.toLowerCase()))) {
                result.blacklisted = true;
                result.isGhost = true;
                result.score = 100;
                result.reasons = ['Blocked company'];
                return result;
            }
        }

        result.isGhost = result.score >= CONFIG.ghostThreshold;

        // Extra filters
        if (CONFIG.hideNoSalary) {
            const salary = getSalary(card);
            if (!salary.listed) result.isGhost = true;
        }

        if (CONFIG.hideOldJobs) {
            const age = getJobAge(card);
            if (age.days && age.days >= CONFIG.oldJobDays) result.isGhost = true;
        }

        if (CONFIG.hideHighApplicants) {
            const applicants = getApplicants(card);
            if (applicants && applicants >= CONFIG.maxApplicants) result.isGhost = true;
        }

        return result;
    }

    // ==================== LIST MANAGEMENT ====================

    function addWhitelist(company) {
        if (!company) return false;
        company = company.toLowerCase().trim();
        if (!CONFIG.companyWhitelist.includes(company)) {
            CONFIG.companyWhitelist.push(company);
            GM_setValue('companyWhitelist', CONFIG.companyWhitelist);
            removeBlacklist(company);
            return true;
        }
        return false;
    }

    function removeWhitelist(company) {
        company = company.toLowerCase().trim();
        const i = CONFIG.companyWhitelist.indexOf(company);
        if (i > -1) {
            CONFIG.companyWhitelist.splice(i, 1);
            GM_setValue('companyWhitelist', CONFIG.companyWhitelist);
            return true;
        }
        return false;
    }

    function addBlacklist(company) {
        if (!company) return false;
        company = company.toLowerCase().trim();
        if (!CONFIG.companyBlacklist.includes(company)) {
            CONFIG.companyBlacklist.push(company);
            GM_setValue('companyBlacklist', CONFIG.companyBlacklist);
            removeWhitelist(company);
            return true;
        }
        return false;
    }

    function removeBlacklist(company) {
        company = company.toLowerCase().trim();
        const i = CONFIG.companyBlacklist.indexOf(company);
        if (i > -1) {
            CONFIG.companyBlacklist.splice(i, 1);
            GM_setValue('companyBlacklist', CONFIG.companyBlacklist);
            return true;
        }
        return false;
    }

    function exportData() {
        const data = {
            companyWhitelist: CONFIG.companyWhitelist,
            companyBlacklist: CONFIG.companyBlacklist,
            settings: { ghostThreshold: CONFIG.ghostThreshold }
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ghost-detector-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.companyWhitelist) {
                        CONFIG.companyWhitelist = [...new Set([...CONFIG.companyWhitelist, ...data.companyWhitelist])];
                        GM_setValue('companyWhitelist', CONFIG.companyWhitelist);
                    }
                    if (data.companyBlacklist) {
                        CONFIG.companyBlacklist = [...new Set([...CONFIG.companyBlacklist, ...data.companyBlacklist])];
                        GM_setValue('companyBlacklist', CONFIG.companyBlacklist);
                    }
                    alert('Imported!');
                    runFilter();
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ==================== UI ====================

    function buildUI() {
        const css = document.createElement('style');
        css.textContent = `
            #gjd-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                color: #e0e0e0;
                padding: 14px;
                border-radius: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                z-index: 999999;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                min-width: 240px;
                max-width: 280px;
                border: 1px solid rgba(255,255,255,0.05);
            }
            #gjd-panel.min { min-width: auto; padding: 8px 12px; }
            #gjd-panel.min .gjd-body { display: none; }
            #gjd-panel.min .gjd-head { margin-bottom: 0; }
            
            .gjd-head {
                display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 10px; cursor: pointer;
            }
            .gjd-title { font-weight: 600; font-size: 13px; }
            .gjd-ver { font-size: 9px; color: #666; margin-left: 6px; }
            .gjd-min { background: none; border: none; color: #555; font-size: 16px; cursor: pointer; }
            .gjd-min:hover { color: #fff; }
            
            .gjd-sec {
                background: rgba(255,255,255,0.03);
                border-radius: 6px; padding: 8px; margin-bottom: 6px;
            }
            .gjd-sec-title {
                font-size: 8px; color: #555; text-transform: uppercase;
                letter-spacing: 0.5px; margin-bottom: 6px;
            }
            
            .gjd-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; }
            .gjd-label { font-size: 11px; color: #aaa; }
            
            .gjd-tog { position: relative; width: 32px; height: 18px; }
            .gjd-tog input { opacity: 0; width: 0; height: 0; }
            .gjd-sl {
                position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                background-color: #333; transition: 0.2s; border-radius: 18px;
            }
            .gjd-sl:before {
                position: absolute; content: ""; height: 12px; width: 12px;
                left: 3px; bottom: 3px; background-color: #888;
                transition: 0.2s; border-radius: 50%;
            }
            input:checked + .gjd-sl { background: #ef4444; }
            input:checked + .gjd-sl:before { transform: translateX(14px); background: #fff; }
            
            .gjd-inp {
                width: 50px; padding: 3px 6px; border-radius: 4px;
                border: 1px solid #333; background: #1a1a2e; color: #fff;
                font-size: 11px; text-align: center;
            }
            
            .gjd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-top: 6px; }
            .gjd-stat { background: rgba(255,255,255,0.03); padding: 5px 2px; border-radius: 4px; text-align: center; }
            .gjd-num { font-size: 13px; font-weight: 700; }
            .gjd-num.red { color: #ef4444; }
            .gjd-num.yel { color: #eab308; }
            .gjd-num.grn { color: #22c55e; }
            .gjd-num.blu { color: #3b82f6; }
            .gjd-lbl { font-size: 7px; color: #555; text-transform: uppercase; }
            
            .gjd-btn {
                background: rgba(255,255,255,0.05); border: none; color: #888;
                padding: 5px 8px; border-radius: 4px; cursor: pointer;
                font-size: 9px; transition: all 0.15s; flex: 1;
            }
            .gjd-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
            .gjd-btns { display: flex; gap: 4px; margin-top: 6px; }
            
            .gjd-hide { display: none !important; }
            
            .gjd-ghost {
                position: relative;
                outline: 3px solid #ef4444 !important;
                outline-offset: -3px;
                opacity: 0.7;
            }
            .gjd-ghost::before {
                content: '👻';
                position: absolute;
                top: 8px;
                right: 8px;
                font-size: 20px;
                z-index: 1000;
            }
            
            .gjd-sus {
                outline: 3px solid #eab308 !important;
                outline-offset: -3px;
            }
            
            .gjd-ok {
                outline: 2px solid #22c55e !important;
                outline-offset: -2px;
            }
            
            .gjd-badge {
                position: absolute;
                top: 4px;
                left: 4px;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                color: white;
                z-index: 1001;
            }
            .gjd-badge.gh { background: #ef4444; }
            .gjd-badge.su { background: #eab308; color: #000; }
            
            .gjd-why {
                position: absolute;
                bottom: 4px;
                left: 4px;
                right: 4px;
                max-height: 60px;
                overflow: hidden;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 9px;
                background: rgba(0,0,0,0.9);
                color: #ccc;
                z-index: 1001;
                line-height: 1.4;
                display: none;
            }
            .gjd-ghost:hover .gjd-why,
            .gjd-sus:hover .gjd-why { display: block; }
            
            .gjd-acts {
                position: absolute;
                top: 4px;
                right: 36px;
                display: flex;
                gap: 2px;
                z-index: 1002;
            }
            .gjd-act {
                background: rgba(0,0,0,0.8);
                border: none;
                color: #fff;
                width: 22px;
                height: 22px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .gjd-ghost:hover .gjd-act,
            .gjd-sus:hover .gjd-act,
            .gjd-done:hover .gjd-act { opacity: 1; }
            .gjd-act:hover { background: rgba(0,0,0,0.95); }
            .gjd-act.wl { background: #22c55e; opacity: 1; }
            .gjd-act.bl { background: #ef4444; opacity: 1; }
            
            .gjd-score {
                position: absolute;
                top: 4px;
                left: 50%;
                transform: translateX(-50%);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 9px;
                font-weight: bold;
                z-index: 1001;
            }
            .gjd-score.hi { background: #ef4444; color: white; }
            .gjd-score.md { background: #eab308; color: black; }
            .gjd-score.lo { background: #22c55e; color: white; }
        `;
        document.head.appendChild(css);

        const panel = document.createElement('div');
        panel.id = 'gjd-panel';
        panel.innerHTML = `
            <div class="gjd-head">
                <span><span class="gjd-title">👻 Ghost Detector</span><span class="gjd-ver">v${VERSION}</span></span>
                <button class="gjd-min">−</button>
            </div>
            <div class="gjd-body">
                <div class="gjd-sec">
                    <div class="gjd-sec-title">Detection</div>
                    <div class="gjd-row">
                        <span class="gjd-label">Enabled</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-on" ${CONFIG.enabled ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                    <div class="gjd-row">
                        <span class="gjd-label">Threshold</span>
                        <input type="number" class="gjd-inp" id="gjd-thresh" value="${CONFIG.ghostThreshold}" min="0" max="100">
                    </div>
                </div>
                
                <div class="gjd-sec">
                    <div class="gjd-sec-title">Extra Filters</div>
                    <div class="gjd-row">
                        <span class="gjd-label">No salary = hide</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-sal" ${CONFIG.hideNoSalary ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                    <div class="gjd-row">
                        <span class="gjd-label">Old jobs (${CONFIG.oldJobDays}d+)</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-old" ${CONFIG.hideOldJobs ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                    <div class="gjd-row">
                        <span class="gjd-label">${CONFIG.maxApplicants}+ applicants</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-app" ${CONFIG.hideHighApplicants ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                </div>
                
                <div class="gjd-sec">
                    <div class="gjd-sec-title">Display</div>
                    <div class="gjd-row">
                        <span class="gjd-label">Highlight mode</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-hl" ${CONFIG.highlightMode ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                    <div class="gjd-row">
                        <span class="gjd-label">Show scores</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-sc" ${CONFIG.showScores ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                    <div class="gjd-row">
                        <span class="gjd-label">Show reasons</span>
                        <label class="gjd-tog"><input type="checkbox" id="gjd-rs" ${CONFIG.showReasons ? 'checked' : ''}><span class="gjd-sl"></span></label>
                    </div>
                </div>
                
                <div class="gjd-sec">
                    <div class="gjd-sec-title">Company Lists</div>
                    <div class="gjd-btns">
                        <button class="gjd-btn" id="gjd-lists">Manage</button>
                        <button class="gjd-btn" id="gjd-imp">Import</button>
                        <button class="gjd-btn" id="gjd-exp">Export</button>
                    </div>
                </div>
                
                <div class="gjd-stats">
                    <div class="gjd-stat">
                        <div class="gjd-num blu" id="gjd-tot">0</div>
                        <div class="gjd-lbl">Total</div>
                    </div>
                    <div class="gjd-stat">
                        <div class="gjd-num red" id="gjd-gh">0</div>
                        <div class="gjd-lbl">Ghost</div>
                    </div>
                    <div class="gjd-stat">
                        <div class="gjd-num yel" id="gjd-sus">0</div>
                        <div class="gjd-lbl">Iffy</div>
                    </div>
                    <div class="gjd-stat">
                        <div class="gjd-num grn" id="gjd-ok">0</div>
                        <div class="gjd-lbl">OK</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Events
        panel.querySelector('.gjd-head').addEventListener('click', (e) => {
            if (!e.target.classList.contains('gjd-min')) panel.classList.toggle('min');
        });
        panel.querySelector('.gjd-min').addEventListener('click', () => panel.classList.toggle('min'));

        const toggles = {
            'gjd-on': 'enabled',
            'gjd-sal': 'hideNoSalary',
            'gjd-old': 'hideOldJobs',
            'gjd-app': 'hideHighApplicants',
            'gjd-hl': 'highlightMode',
            'gjd-sc': 'showScores',
            'gjd-rs': 'showReasons'
        };

        for (const [id, key] of Object.entries(toggles)) {
            document.getElementById(id)?.addEventListener('change', (e) => {
                CONFIG[key] = e.target.checked;
                GM_setValue(key, e.target.checked);
                runFilter();
            });
        }

        document.getElementById('gjd-thresh')?.addEventListener('change', (e) => {
            CONFIG.ghostThreshold = parseInt(e.target.value) || 50;
            GM_setValue('ghostThreshold', CONFIG.ghostThreshold);
            runFilter();
        });

        document.getElementById('gjd-lists')?.addEventListener('click', showLists);
        document.getElementById('gjd-imp')?.addEventListener('click', importData);
        document.getElementById('gjd-exp')?.addEventListener('click', exportData);
    }

    function showLists() {
        const old = document.getElementById('gjd-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'gjd-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9); z-index: 9999999;
            display: flex; align-items: center; justify-content: center;
        `;

        modal.innerHTML = `
            <div style="background: #1a1a2e; border-radius: 10px; padding: 16px;
                max-width: 400px; width: 90%; max-height: 80vh; overflow-y: auto;
                color: #e0e0e0; font-family: -apple-system, sans-serif;">
                
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <button id="gjd-tw" style="flex:1; padding: 8px; border: none; 
                        background: #22c55e; color: white; border-radius: 6px; cursor: pointer;">
                        ✓ Trusted (${CONFIG.companyWhitelist.length})
                    </button>
                    <button id="gjd-tb" style="flex:1; padding: 8px; border: none;
                        background: #333; color: #888; border-radius: 6px; cursor: pointer;">
                        🚫 Blocked (${CONFIG.companyBlacklist.length})
                    </button>
                </div>
                
                <input type="text" id="gjd-add" placeholder="Add company..."
                    style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #333;
                    background: #252542; color: #fff; font-size: 12px; box-sizing: border-box; margin-bottom: 10px;">
                
                <div id="gjd-wl">
                    ${CONFIG.companyWhitelist.length === 0 ? 
                        '<p style="color: #444; text-align: center; padding: 16px;">No trusted companies</p>' :
                        CONFIG.companyWhitelist.map(c => `
                            <div style="display: flex; justify-content: space-between; align-items: center;
                                padding: 6px 8px; background: rgba(34,197,94,0.1); border-radius: 4px; margin-bottom: 4px;">
                                <span style="font-size: 11px;">${c}</span>
                                <button data-c="${c}" data-l="w" class="gjd-rm" style="background: #ef4444; border: none; color: white;
                                    padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 9px;">✕</button>
                            </div>
                        `).join('')
                    }
                </div>
                
                <div id="gjd-bl" style="display: none;">
                    ${CONFIG.companyBlacklist.length === 0 ? 
                        '<p style="color: #444; text-align: center; padding: 16px;">No blocked companies</p>' :
                        CONFIG.companyBlacklist.map(c => `
                            <div style="display: flex; justify-content: space-between; align-items: center;
                                padding: 6px 8px; background: rgba(239,68,68,0.1); border-radius: 4px; margin-bottom: 4px;">
                                <span style="font-size: 11px;">${c}</span>
                                <button data-c="${c}" data-l="b" class="gjd-rm" style="background: #22c55e; border: none; color: white;
                                    padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 9px;">✓</button>
                            </div>
                        `).join('')
                    }
                </div>
                
                <button id="gjd-done" style="width: 100%; margin-top: 12px; padding: 10px;
                    border-radius: 6px; border: none; background: #333; color: white; cursor: pointer;">Done</button>
            </div>
        `;

        document.body.appendChild(modal);

        let list = 'w';

        document.getElementById('gjd-tw').addEventListener('click', () => {
            list = 'w';
            document.getElementById('gjd-tw').style.background = '#22c55e';
            document.getElementById('gjd-tw').style.color = 'white';
            document.getElementById('gjd-tb').style.background = '#333';
            document.getElementById('gjd-tb').style.color = '#888';
            document.getElementById('gjd-wl').style.display = '';
            document.getElementById('gjd-bl').style.display = 'none';
        });

        document.getElementById('gjd-tb').addEventListener('click', () => {
            list = 'b';
            document.getElementById('gjd-tb').style.background = '#ef4444';
            document.getElementById('gjd-tb').style.color = 'white';
            document.getElementById('gjd-tw').style.background = '#333';
            document.getElementById('gjd-tw').style.color = '#888';
            document.getElementById('gjd-wl').style.display = 'none';
            document.getElementById('gjd-bl').style.display = '';
        });

        document.getElementById('gjd-add').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                const name = e.target.value.trim();
                if (list === 'w') addWhitelist(name);
                else addBlacklist(name);
                modal.remove();
                showLists();
                runFilter();
            }
        });

        modal.querySelectorAll('.gjd-rm').forEach(btn => {
            btn.addEventListener('click', () => {
                const c = btn.dataset.c;
                if (btn.dataset.l === 'w') removeWhitelist(c);
                else removeBlacklist(c);
                modal.remove();
                showLists();
                runFilter();
            });
        });

        document.getElementById('gjd-done').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    function updateStats() {
        document.getElementById('gjd-tot').textContent = stats.total;
        document.getElementById('gjd-gh').textContent = stats.flagged;
        document.getElementById('gjd-sus').textContent = stats.suspicious;
        document.getElementById('gjd-ok').textContent = stats.clean;
    }

    // ==================== FILTERING ====================

    let running = false;

    function findCards() {
        const host = window.location.hostname;
        let sels = [];

        if (host.includes('linkedin')) {
            sels = ['.job-card-container', '.jobs-search-results__list-item', '[data-job-id]', '.scaffold-layout__list-item'];
        } else if (host.includes('indeed')) {
            sels = ['.job_seen_beacon', '.jobsearch-ResultsList > li', '[data-jk]', '.result'];
        } else if (host.includes('glassdoor')) {
            sels = ['[data-test="jobListing"]', '.react-job-listing', 'li[data-id]'];
        } else if (host.includes('ziprecruiter')) {
            sels = ['.job_result', '[data-job-id]'];
        } else {
            sels = ['[class*="job-card"]', '[class*="job-listing"]', '[data-job-id]'];
        }

        const cards = new Set();
        sels.forEach(s => {
            document.querySelectorAll(s).forEach(el => {
                if (el.offsetHeight > 50 && el.offsetWidth > 50) cards.add(el);
            });
        });

        return Array.from(cards);
    }

    async function runFilter() {
        if (running || !CONFIG.enabled) return;
        running = true;

        stats.total = 0;
        stats.flagged = 0;
        stats.suspicious = 0;
        stats.clean = 0;

        document.querySelectorAll('.gjd-ghost, .gjd-sus, .gjd-ok, .gjd-hide, .gjd-done').forEach(el => {
            el.classList.remove('gjd-ghost', 'gjd-sus', 'gjd-ok', 'gjd-hide', 'gjd-done');
        });
        document.querySelectorAll('.gjd-badge, .gjd-score, .gjd-why, .gjd-acts').forEach(el => el.remove());

        const cards = findCards();
        stats.total = cards.length;

        for (const card of cards) {
            processCard(card);
        }

        updateStats();
        running = false;
    }

    function processCard(card) {
        const result = analyzeJob(card);

        card.classList.add('gjd-done');
        card.style.position = 'relative';

        if (result.whitelisted) {
            stats.clean++;
            if (CONFIG.highlightMode) card.classList.add('gjd-ok');
            return;
        }

        if (result.isGhost) {
            stats.flagged++;

            if (CONFIG.highlightMode) {
                card.classList.add('gjd-ghost');

                const badge = document.createElement('div');
                badge.className = 'gjd-badge gh';
                badge.textContent = `👻 ${result.score}%`;
                card.appendChild(badge);

                if (CONFIG.showReasons && result.reasons.length) {
                    const why = document.createElement('div');
                    why.className = 'gjd-why';
                    why.innerHTML = `<b>Why:</b><br>${result.reasons.slice(0, 4).join('<br>')}`;
                    card.appendChild(why);
                }

                addActions(card, result);
            } else {
                card.classList.add('gjd-hide');
            }
        } else if (result.score >= 30) {
            stats.suspicious++;

            if (CONFIG.highlightMode) {
                card.classList.add('gjd-sus');

                if (CONFIG.showScores) {
                    const sc = document.createElement('div');
                    sc.className = 'gjd-score md';
                    sc.textContent = `${result.score}%`;
                    card.appendChild(sc);
                }

                if (CONFIG.showReasons && result.reasons.length) {
                    const why = document.createElement('div');
                    why.className = 'gjd-why';
                    why.innerHTML = result.reasons.slice(0, 3).join('<br>');
                    card.appendChild(why);
                }

                addActions(card, result);
            }
        } else {
            stats.clean++;
            
            if (CONFIG.showScores && CONFIG.highlightMode) {
                const sc = document.createElement('div');
                sc.className = 'gjd-score lo';
                sc.textContent = `${result.score}%`;
                card.appendChild(sc);
            }
        }
    }

    function addActions(card, result) {
        const acts = document.createElement('div');
        acts.className = 'gjd-acts';

        const trust = document.createElement('button');
        trust.className = 'gjd-act';
        trust.innerHTML = '✓';
        trust.title = 'Trust this company';
        trust.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (result.company && addWhitelist(result.company)) {
                trust.classList.add('wl');
                runFilter();
            }
        });
        acts.appendChild(trust);

        const block = document.createElement('button');
        block.className = 'gjd-act';
        block.innerHTML = '🚫';
        block.title = 'Block this company';
        block.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (result.company && addBlacklist(result.company)) {
                block.classList.add('bl');
                runFilter();
            }
        });
        acts.appendChild(block);

        card.appendChild(acts);
    }

    // ==================== OBSERVER ====================

    function watch() {
        let t;
        const obs = new MutationObserver(() => {
            clearTimeout(t);
            t = setTimeout(runFilter, 500);
        });
        obs.observe(document.body, { childList: true, subtree: true });

        let st;
        window.addEventListener('scroll', () => {
            clearTimeout(st);
            st = setTimeout(runFilter, 600);
        }, { passive: true });
    }

    // ==================== INIT ====================

    function init() {
        console.log('[Ghost Detector] v' + VERSION);
        buildUI();
        watch();
        setTimeout(runFilter, 800);

        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('Refresh', runFilter);
            GM_registerMenuCommand('Manage Lists', showLists);
            GM_registerMenuCommand('Export', exportData);
            GM_registerMenuCommand('Import', importData);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
