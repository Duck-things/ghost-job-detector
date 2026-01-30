# 👻 Ghost Job Detector

Spot fake job listings before you waste time applying.

**By Achyut Sharma**

---

## The Problem

I spent 6 months job hunting. Applied to probably 300+ positions. Heard back from maybe 10.

After a while I started noticing patterns. Jobs posted 4 months ago that were "urgently hiring." Listings with 1000+ applicants that never closed. "Entry level" roles wanting 5 years of experience. 

Turns out these are called "ghost jobs" - companies post them to farm resumes, look like they're growing, or just forget to take them down. Meanwhile you're spending hours tailoring your resume for positions that don't exist.

So I built this.

## What It Does

It's a browser script that analyzes job listings and gives them a "ghost score" from 0-100%. Higher score = more likely fake.

Works on:
- LinkedIn
- Indeed  
- Glassdoor
- ZipRecruiter
- Dice
- Monster

## Install

1. Get [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. [Click here to install the script](../../raw/main/scripts/ghost-job-detector.user.js)
3. Go to LinkedIn Jobs or Indeed
4. Look for the panel in the bottom right

## What It Looks For

**Red flags that increase the score:**

- Posted 30/60/90+ days ago
- 200/500/1000+ applicants but still open
- No salary listed
- "Competitive salary" (usually means low)
- Salary range is $50K+ wide (they don't know what they want)
- "Entry level" but requires 5+ years
- Wants 10 different technologies
- Staffing agency
- "Hiring for a client"
- Short/vague description
- No team or manager info
- Red flag phrases: "fast-paced", "like a family", "wear many hats", "rockstar", etc.

**Green flags that lower the score:**

- Salary clearly listed
- Posted recently
- Specific team mentioned
- Hiring manager named
- Interview process described
- Benefits detailed

## How Scoring Works

| Score | What it means |
|-------|---------------|
| 0-30 | Probably legit |
| 30-50 | Some concerns |
| 50-70 | Suspicious |
| 70-100 | Likely ghost job |

Default threshold is 50. Jobs above that get flagged.

## Features

**Ghost Score** - Every job gets a 0-100% score

**Why Flagged** - Hover over flagged jobs to see reasons

**Trust/Block Companies** - Whitelist companies you trust, blacklist ones you don't

**Filters** - Optionally auto-hide jobs with no salary, 500+ applicants, or posted 60+ days ago

**Import/Export** - Share your company lists

## Settings

The control panel has toggles for:

- Enable/disable detection
- Ghost threshold (0-100)
- Hide jobs with no salary
- Hide old jobs (60+ days)
- Hide high applicant jobs (500+)
- Highlight mode vs hide mode
- Show scores
- Show reasons

## FAQ

**Won't this miss some ghost jobs?**

Yeah, probably. It's not perfect. But it catches the obvious ones and saves time.

**What if it flags a real job?**

Hover over it and click the ✓ button to trust that company. Their jobs won't get flagged anymore.

**Does this send my data anywhere?**

No. Runs entirely in your browser.

**Why is [company] flagged?**

Hover over it to see the reasons. Usually it's a combination of things - old posting + no salary + vague description, etc.

## Contributing

Found a bug? Think the scoring is off? Open an issue.

Know a pattern that indicates ghost jobs? Let me know.

## License

MIT

---

Made by [Achyut Sharma](https://github.com/achyutsharma)

If this helped, consider starring the repo 👻

## HackClub!
I’m 13 years old and I just joined this thing called Hack Club Flavortown, and it’s honestly really cool so I wanted to share.

Flavortown is a Hack Club event where teens (13–18) work on CAD, hardware, and personal projects, and you earn shards for building stuff. You can then spend those shards in the Hack Club shop on real hardware 👀 like Raspberry Pi 5s, parts, tools, etc.

I’m currently working on robotics projects (I built a robot that detects falls for seniors), and I REALLY want to get a Raspberry Pi 5 so I can keep building and improving my projects. The only way I can do that is by earning shards through Flavortown.

If you sign up using my referral link, it helps me get closer to that goal 🙏
👉 https://flavortown.hack.club/?ref=BZJXIBQ9

What I like about the event:

It’s actually made for teens, not adults

You work on real projects, not boring tutorials

You get rewarded for building, not just watching videos

Hack Club is a real nonprofit (not a scam lol)

If you’re into:

-CAD

-Robotics

-Coding

-Hardware

Or just making cool stuff!

You should totally check it out. Even if you don’t use my link, still join — but using it would seriously help me out 🫶

Thanks for reading, and happy hacking 🚀
