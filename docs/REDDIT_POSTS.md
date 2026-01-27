# Reddit Posts

## Main Post - r/recruitinghell

**Title:** After getting ghosted by 200+ "urgent hire" positions, I built something to detect fake job listings

---

Been job hunting for 6 months. You know the drill - spend an hour customizing your resume, write a cover letter, apply, never hear back.

After a while I started keeping track of the listings I applied to. Noticed some patterns:

- Jobs posted 3+ months ago that say "urgently hiring" 
- Listings with 800+ applicants that never close
- "Entry level" positions that want 5 years experience
- Same job reposted every week by staffing agencies
- "Competitive salary" with zero actual numbers

These are ghost jobs. Companies post them to collect resumes, look like they're growing, or just never bother to take them down.

So I made a browser extension that flags them.

It gives every job listing a "ghost score" from 0-100 based on how many red flags it has. Old posting + no salary + vague description + "we're like a family" = probably fake.

It's a Tampermonkey script, works on LinkedIn, Indeed, Glassdoor, ZipRecruiter. Free, no data collection, just runs in your browser.

GitHub link: [link]

Not saying it's perfect but it's saved me from wasting time on a bunch of obvious garbage. Hover over flagged jobs to see why they got flagged.

You can also whitelist/blacklist companies. If you know a company is legit, one click and their jobs don't get flagged anymore.

lmk if you find bugs or have suggestions

---

## Second Post - r/jobs

**Title:** Made a free tool that detects ghost job listings

---

Quick background - been job hunting for months, realized a ton of the jobs I was applying to were probably fake. Old listings, no salary info, impossible requirements, the usual.

Built a browser script that scores job listings based on red flags:

- How long it's been posted
- How many applicants
- Whether salary is listed
- If the requirements make sense
- Sketchy phrases like "fast-paced environment" or "wear many hats"

Score goes from 0-100. Over 50 = probably a ghost job.

Works on LinkedIn, Indeed, Glassdoor, etc. Free and open source.

Link: [github link]

Hover over flagged jobs to see exactly why. You can trust/block companies too.

Not a silver bullet but it's helped me avoid the obvious trash.

---

## Third Post - r/cscareerquestions

**Title:** Built a userscript to flag suspicious job listings - looking for feedback on the scoring algorithm

---

After months of job hunting I got fed up with ghost jobs and built a detector.

Basic idea: scan job listings for red flags, assign point values, add them up.

Red flags:
- Posted 90+ days ago: +30 points
- 1000+ applicants: +25 points  
- Entry level + wants 5yr experience: +25 points
- No salary: +15 points
- Staffing agency: +10 points
- "Fast-paced"/"like a family"/etc: +5-10 points each

Green flags (reduce score):
- Salary listed: -10 points
- Hiring manager named: -10 points
- Recent posting: -10 points

Jobs over 50 points get flagged.

GitHub: [link]

Looking for feedback:
1. Are these weights reasonable?
2. Any red flags I'm missing?
3. False positives you've seen?

First time open sourcing something so code feedback welcome too.

---

## Fourth Post - r/antiwork

**Title:** Companies post thousands of fake job listings. Here's how to spot them.

---

Ghost jobs are real. Companies post jobs they have no intention of filling because:

- Makes them look like they're growing (good for investors)
- Collects resumes to lowball people later  
- Keeps current employees scared they're replaceable
- HR needs to justify their budget

Meanwhile people are spending hours applying to jobs that don't exist.

I got sick of it so I made a tool that detects them. It's a browser extension that scans job listings and flags the suspicious ones.

It checks for stuff like:
- Job posted months ago but still "urgently hiring"
- Hundreds of applicants but listing never closes
- No salary info
- Ridiculous requirements
- Corporate buzzword bingo

Free, open source, doesn't collect any data.

Link: [github]

The job market is rigged enough without this crap.

---

## Posting Tips

1. Post to r/recruitinghell first - they hate ghost jobs the most
2. Reply to comments, especially in the first hour
3. Don't post to all subs at once, space them out
4. Add a screenshot before posting
5. Be humble - "not perfect but it helps"
