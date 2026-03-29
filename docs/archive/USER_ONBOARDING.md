# ApplyFlow Auto-Apply: User Onboarding Guide

Welcome! This guide helps you get started with ApplyFlow's auto-apply feature.

---

## What is Auto-Apply?

Auto-apply automatically submits job applications on your behalf based on your preferences. It:

✅ **Finds matching jobs** based on your criteria
✅ **Pre-fills forms** with your profile information
✅ **Handles challenges** like CAPTCHAs with your help
✅ **Learns from outcomes** to improve recommendations
✅ **Saves you time** by applying to 10+ jobs per day

---

## Getting Started (5 minutes)

### Step 1: Install the Extension

The ApplyFlow extension is required for auto-apply to work.

**Chrome/Edge:**
1. Visit Chrome Web Store
2. Search "ApplyFlow"
3. Click "Add to Chrome"
4. Grant permissions when prompted

> The extension needs permission to fill forms on job boards. We never send your data anywhere—it processes locally.

### Step 2: Configure Auto-Apply

1. Go to ApplyFlow → **Settings** → **Auto-Apply**
2. Or visit: `/dashboard/auto-apply/settings`

**Initial Setup (2 minutes):**

```
🎯 Auto-Apply Status: [Toggle ON]

Score Threshold: 70/100
├─ Higher = more selective (only very similar jobs)
└─ Lower = more applications (more likely to apply)

Daily Limit: 5 applications per day
├─ Conservative: 3/day
├─ Moderate: 5/day (recommended)
└─ Aggressive: 10+/day (requires close monitoring)

Work Mode: [✓] Remote  [ ] Hybrid  [ ] On-Site

File Uploads:
├─ [✓] Auto-attach resume
└─ [ ] Auto-attach other documents

Form Submission:
└─ [ ] Auto-submit forms (KEEP OFF for now)
```

### Step 3: Save and Test

Click **Save Settings**. You're ready to apply!

---

## Using Auto-Apply

### Find Jobs

1. Go to **Recommendations** or **Search Jobs**
2. Search for a position (e.g., "Senior Software Engineer")
3. You'll see recommended jobs ranked by match score
4. Click **Apply** on jobs you like

> When you click "Apply", the job is added to your queue. The scheduler will process it automatically!

### Monitor Your Queue

**Dashboard** shows:
- ✅ **Successfully Applied**: How many jobs you've applied to
- ⏳ **In Queue**: Jobs waiting to be processed
- ⚠️ **Pending Tasks**: Manual actions needed (CAPTCHA, uploads, etc.)
- ❌ **Failed**: Jobs that didn't work (usually site outage)

Visit `/dashboard/auto-apply` to see real-time stats.

### Complete Manual Tasks

Some applications need your help:

**What is a Manual Task?**
- **CAPTCHA**: Security challenge ("Select all buses")
- **File Upload**: Resume or documents to attach
- **MFA/2FA**: Code from email or phone
- **Form Review**: Pre-filled form you need to verify

**To Complete Tasks:**

1. Go to **Pending Tasks** (or `/dashboard/auto-apply/pending-tasks`)
2. You'll see a list of jobs needing action
3. For each task:
   - Read the instructions
   - Click "Go to Job" (opens the application)
   - Complete the action (solve CAPTCHA, upload file, etc.)
   - Come back and click "Task Complete"

> **Pro Tip**: Do manual tasks within 24 hours. After 48 hours, the task expires and won't be applied to.

---

## Recording Application Outcomes

Telling us how applications went helps improve future recommendations.

**When to Record:**
- Application rejected
- No response (ghosted) after 2+ weeks
- Got an interview
- Received a job offer

**How to Record:**

1. Find the job in your **Job Applications**
2. Click "Record Outcome"
3. Select: Rejected | Ghosted | Interview | Offer
4. Add optional notes
5. Click "Record Outcome"

> The more outcomes you record, the better our AI gets at finding good matches for you!

---

## Best Practices

### ✅ DO:

- **Start conservative**: Enable with score 75+, 3/day limit
- **Monitor daily**: Check dashboard and pending tasks
- **Complete tasks quickly**: Do them within 24 hours
- **Record outcomes**: Let us know what happened
- **Adjust thresholds**: Increase or decrease based on results
- **Exclude bad companies**: Add to "exclude companies" list

### ❌ DON'T:

- **Enable auto-submit**: We recommend keeping forms open for review
- **Set very low scores**: You'll get lots of irrelevant jobs
- **Ignore pending tasks**: We wait for you to complete them
- **Apply to everything**: Focus quality over quantity
- **Use outdated resume**: Update if your skills have changed

---

## Score Thresholds Guide

**What is the Match Score?**

Jobs are scored 0-100 based on:
- Role similarity (50% weight)
- Skills alignment (30% weight)
- Location/remote match (20% weight)

**Recommended Thresholds:**

| Score | Recommendation | Result |
|-------|-----------------|--------|
| **50-60** | Too low | Mostly irrelevant jobs |
| **60-70** | Conservative | Good role fit, some mismatches |
| **70-80** | Balanced | Most are good matches |
| **80-90** | Selective | Very similar to profile |
| **90+** | Very selective | Perfect matches (rare) |

**Pro Tip**: Start at 70. After 2 weeks, adjust based on:
- Too many irrelevant jobs → Increase to 75-80
- Not getting enough → Decrease to 65-70

---

## Examples

### Example 1: Your First Application

```
1. You search "Python Developer" → Find 20 matching jobs
2. Click "Apply" on a job with score 78
3. Job added to queue ✅

Job is processed automatically:
├─ Scheduler finds job at 3 PM
├─ Extension detects form and fills your info
├─ Extension sees file upload required
└─ Creates "File Upload" task

4. You get notification: 1 pending task
5. You go to job, upload your resume
6. Click "Task Complete" in ApplyFlow
7. Application is submitted! ✅
```

### Example 2: Recording an Outcome

```
1. Two weeks later, you get rejected email
2. Go to your jobs, find "Python Developer at XYZ Corp"
3. Click "Record Outcome"
4. Select "Rejected"
5. Note: "Asked too much experience"
6. Click "Record Outcome" ✅

Next time you see similar jobs:
- Our AI learns you're not getting callbacks for senior roles
- Scores similar companies lower
- Recommends more mid-level roles instead
```

### Example 3: Tuning Your Settings

```
Week 1: Score 70, 5/day
├─ Applied to 30 jobs
├─ 20 "pending tasks" (lots of CAPTCHAs)
└─ Feel like applying to everything

Week 2: Increase score to 75, reduce to 3/day
├─ 15 applications
├─ 8 pending tasks
└─ Better quality matches

Week 3: Found sweet spot!
└─ Keep at 75, 3/day
```

---

## Troubleshooting

### "Auto-Apply is Disabled"
- Go to Settings
- Toggle **Auto-Apply Status** ON
- Click **Save Settings**

### "No Pending Tasks But Jobs in Queue"
- Check score threshold isn't too high
- Verify you clicked "Apply" correctly
- Wait 10 minutes (scheduler runs every 10 mins)

### "Task Expired"
- Actions older than 48 hours expire
- Complete them within 24 hours when possible
- Job will be requeued if not completed

### "Not Getting Applications"
- Check score threshold (too high?)
- Verify profile is complete
- Try searching for more common roles
- Check exclude lists aren't too restrictive

### "Getting Irrelevant Jobs"
- Increase score threshold
- Add keywords to exclude list
- Update profile with current skills
- Record "rejected" outcomes to train our AI

### "Can't Upload Files"
- Check file is under 5MB
- Verify file format is supported (PDF, DOCX, etc.)
- Try different file name
- Contact support if still failing

---

## FAQs

**Q: Will this apply to jobs I don't want?**
A: Only if they match your score threshold and filters. You can adjust at any time or add to exclude lists.

**Q: Can I use auto-submit?**
A: Yes, once you've tested it and trust the system. We recommend staying with manual verification first.

**Q: What if something goes wrong?**
A: All applications are logged. You can review what was submitted in your **Job Applications**.

**Q: How does feedback learning work?**
A: When you record outcomes, our AI learns which job types lead to interviews. Future recommendations improve over time.

**Q: Can I disable auto-apply temporarily?**
A: Yes! Toggle it OFF in settings. Existing queue items will still be processed (you can delete them if needed).

**Q: What about privacy?**
A: Your data stays in your ApplyFlow account. We never share applications with third parties.

**Q: How many jobs can I apply to per day?**
A: You set the limit (1-50). We recommend 5-10 per day. More than that might trigger anti-bot detection.

---

## Getting Help

### In-App Support
- Click **Help** or **?** icon in the app
- Check this guide or FAQs
- Use in-app feedback button

### Contact Us
- Email: support@applyflow.com
- Discord community: [Link]
- Twitter: @ApplyFlow

### Reporting Issues
- Screenshot the error
- Include: browser + OS + what you were doing
- Send to support (we typically respond <24 hours)

---

## Tips for Success

### 💡 Pro Tips

1. **Update your profile**: Better profile = better recommendations
2. **Record outcomes**: Even "rejected" helps (teaches us what you don't want)
3. **Check daily**: Takes 2 minutes to review and complete tasks
4. **Adjust gradually**: Change one setting at a time
5. **Trust the system**: Takes 2-4 weeks to see patterns

### 📊 Tracking Progress

Keep a simple log:
```
Week 1: 20 applications, 2 interviews
Week 2: 25 applications, 3 interviews
Week 3: 30 applications, 4 interviews
```

You should see increasing interview rate over time.

### 🎯 Goal Setting

Examples:
- "Get 3 interviews this month"
- "Apply to 100 jobs by end of quarter"
- "Get 1 offer by next month"
- "Reach 50%+ interview rate"

---

## What Happens Next

### Short Term (Week 1)
- ✅ Set up auto-apply
- ✅ Apply to 10-20 jobs
- ✅ Complete manual tasks
- ✅ Record first outcomes

### Medium Term (Week 2-4)
- ✅ Adjust score/limits based on results
- ✅ See interviews coming in
- ✅ Record more outcomes
- ✅ System learning improves recommendations

### Long Term (Month 2+)
- ✅ Significant increase in interview rate
- ✅ Job offers arriving
- ✅ Can increase application volume if needed
- ✅ Recommend to friends who can use it

---

## Feedback

We'd love to hear from you!

- What's working well?
- What's confusing?
- What features would help?
- Any bugs or issues?

Click **Feedback** in the app or email support@applyflow.com

---

## Security & Privacy

✅ **We don't:**
- Store your passwords
- Share data with employers
- Use applications for marketing
- Spam on your behalf

✅ **We do:**
- Keep your data encrypted
- Log all actions (for your transparency)
- Only use your profile for recommendations
- Delete data when you request it

---

## Success Stories

Real examples from users:

> "I applied to 50 jobs in a month and got 5 interviews. Would have spent weeks doing it manually!"
> — Sarah, Product Manager

> "The feedback learning actually works. After 3 weeks, I'm getting way better job matches."
> — Marcus, Senior Engineer

> "Finally someone solved the clicking 'Apply' button 500 times problem!"
> — James, Recent Graduate

---

## You're Ready! 🚀

You now know everything you need to use ApplyFlow Auto-Apply effectively.

**Next steps:**
1. Install the extension
2. Go to settings and enable auto-apply
3. Search for a job and apply
4. Check pending tasks
5. Complete at least one task
6. Feel how much time you save!

**Questions?** Check FAQs or contact support.

**Ready to find your next job?** Let's go! 🎯

---

**Version 1.0** | Last Updated: March 2025
**Questions? support@applyflow.com**
