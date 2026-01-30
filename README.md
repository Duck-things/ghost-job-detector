# Ghost Job Detector

Spot fake and ghost job listings on LinkedIn, Indeed, Glassdoor, and more.

## Why This Exists

After see so many people complain about this I thought to make something!

- Farm resumes for future openings
- Look like theyre growing to investors
- Keep a "pipeline" even when not hiring
- Just forget to take them down after filling

This script flags the suspicious ones so you dont waste your time.

## Three Versions

| Version | File | Detection | Best For |
|---------|------|-----------|----------|
| **Basic** | `ghost-job-detector-basic.user.js` | Age + applicants only | Just want obvious filtering |
| **Advanced** | `ghost-job-detector-advanced.user.js` | Full heuristics + text analysis | Most users |
| **ML (Machine Leaning)** | `ghost-job-detector-ml.user.js` | Heuristics + custom ML model | Power users who want to train models |

## Features

| Feature | Basic | Advanced | ML |
|---------|:-----:|:--------:|:--:|
| Age detection | ✓ | ✓ | ✓ |
| Applicant count | ✓ | ✓ | ✓ |
| Salary check | ✓ | ✓ | ✓ |
| Red flag phrases | | ✓ | ✓ |
| Staffing agency detection | | ✓ | ✓ |
| Entry level + high exp | | ✓ | ✓ |
| Company whitelist/blacklist | | ✓ | ✓ |
| Import/export | | ✓ | ✓ |
| Custom ML model | | | ✓ |

## Supported Sites

| Site | Status |
|------|--------|
| LinkedIn | Full |
| Indeed | Full |
| Glassdoor | Full |
| ZipRecruiter | Full |
| Dice | Partial |
| Monster | Partial |

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Click to install your preferred version:
   - [Basic](../../raw/main/scripts/ghost-job-detector-basic.user.js)
   - [Advanced](../../raw/main/scripts/ghost-job-detector-advanced.user.js) (recommended)
   - [ML](../../raw/main/scripts/ghost-job-detector-ml.user.js)
3. Browse jobs on supported sites

## How Scoring Works

Jobs start at 0 and get points for red flags:

### Age

| Condition | Points |
|-----------|--------|
| 90+ days | +30 |
| 60+ days | +20 |
| 30+ days | +10 |
| Reposted | +15 |
| Recent (<7 days) | -10 |

### Applicants

| Condition | Points |
|-----------|--------|
| 1000+ | +25 |
| 500+ | +20 |
| 200+ | +10 |
| <50 | -5 |

### Salary

| Condition | Points |
|-----------|--------|
| Not listed | +15 |
| $50k+ range | +15 |
| "Competitive" | +10 |
| Listed | -10 |

### Red Flags (Advanced/ML)

| Phrase | Points |
|--------|--------|
| "Fast-paced" | +5 |
| "Like a family" | +10 |
| "Wear many hats" | +10 |
| "Self-starter" | +5 |
| "Unlimited PTO" | +5 |
| "Ground floor" | +10 |
| "Rockstar/Ninja" | +10 |
| "Hustle/Grind" | +10 |
| "Urgent hire" | +15 |
| Staffing agency | +10 |
| "Hiring for client" | +15 |
| Entry level + 5yr exp | +25 |

### Good Signs

| Sign | Points |
|------|--------|
| Salary listed | -10 |
| Recent posting | -10 |
| Few applicants | -5 |
| Hiring manager named | -10 |
| Benefits detailed | -5 |

## Threshold

Default threshold is 50:
- **50+** = Ghost (red border)
- **30-49** = Suspicious (yellow border)
- **<30** = Probably OK (green if scores shown)

Adjust in the panel to be more or less aggressive.

## Panel

Floating panel in bottom right shows:
- Total jobs scanned
- Ghost count
- Suspicious count
- OK count

## Card Actions (Advanced/ML)

Hover over a flagged job to see:
- **+** button: Trust this company (whitelist)
- **x** button: Block this company (blacklist)

## Company Lists

### Managing
Click "Manage" to view and edit your lists.

### Import/Export
Share lists with others or backup your data.

## Training Your Own Model (ML Version)

See [TRAINING_GUIDE.md](docs/TRAINING_GUIDE.md) for step-by-step instructions on:

1. Collecting training data
2. Extracting features
3. Training with TensorFlow
4. Converting for browser
5. Hosting your model

The `training/` folder has ready-to-use Python scripts.

## FAQ

**Q: Why is X job flagged?**
Hover to see reasons. Whitelist the company if its wrong.

**Q: Can I adjust sensitivity?**
Yes, change the threshold. Lower = more aggressive.

**Q: Does this work on mobile?**
No, needs Tampermonkey on desktop browser.

**Q: Does this send data anywhere?**
No, everything runs locally.

**Q: How accurate is it?**
Not perfect. Its based on patterns I noticed after months of job hunting. Use your judgment.

## Known Issues

- Sites change their HTML which can break detection
- Applicant counts arent always visible
- Mobile site versions not supported

## Changelog

### v2.0.0
- Three versions (Basic, Advanced, ML)
- TensorFlow.js support for custom models
- Training guide and scripts
- Improved heuristics

### v1.0.0
- Initial release
- Basic detection

## Contributing

Found a bug? Have a red flag phrase to add? Open an issue or PR.

## License

This project is licensed under the [MIT License](LICENSE).

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
