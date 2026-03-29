# ApplyFlow Auto-Apply: Quick Start Guide

Get up and running with the auto-apply system in 15 minutes.

## Prerequisites
- Node.js 18+
- Firebase project created
- API keys from job boards (or use mock data to test)

## Step 1: Install & Setup (5 minutes)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Update .env.local with your Firebase credentials
# (Keep job board API keys blank for now - you can test without them)
```

## Step 2: Configure Firebase (3 minutes)

Your Firebase setup is already in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CREDENTIALS={...}
```

Ensure these are filled in from your Firebase console.

## Step 3: Start Development Server (2 minutes)

```bash
npm run dev
```

Server starts at http://localhost:3000

## Step 4: Enable Auto-Apply (3 minutes)

1. Sign in with your test account
2. Go to `/dashboard/auto-apply/settings`
3. Toggle "Auto-Apply Status" **ON**
4. Set minimum score: **70**
5. Set daily limit: **3**
6. Enable "Auto-attach resume"
7. Keep "Auto-submit" **OFF** (for safety testing)
8. Click **Save Settings**

## Step 5: Test the Queue System

Open browser console and run:

```javascript
// Check if auto-apply is enabled
fetch('/api/auto-apply/process', {
  headers: {
    'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}`
  }
}).then(r => r.json()).then(data => {
  console.log('Queue stats:', data.stats);
  console.log('Queue size:', data.stats?.total);
})
```

Expected output:
```json
{
  "stats": {
    "total": 0,
    "pending": 0,
    "submitted": 0,
    "failed": 0,
    "manualActionNeeded": 0,
    "successRate": 0
  }
}
```

## Step 6: Test Job Recommendations

1. Go to `/dashboard/recommendations`
2. Search for a job: `"Software Engineer"`
3. You should see recommendations (even without job board APIs configured)
4. These come from mock data for testing

## Step 7: Simulate Auto-Apply

Since we can't actually apply without job board APIs, let's create a fake queue item:

```javascript
// In browser console on an authenticated page
const uid = firebase.auth().currentUser.uid;

// Add a fake job to the queue
await firebase.firestore().collection(`users/${uid}/auto-apply-queue`).add({
  recommendationId: 'test-job-1',
  jobId: 'job-123',
  jobTitle: 'Senior Software Engineer',
  company: 'Test Company',
  jobUrl: 'https://example.com/jobs/123',
  status: 'pending',
  priority: 80,
  addedAt: new Date().toISOString(),
  retryCount: 0
});

console.log('Test job added to queue!');
```

## Step 8: Check Queue Status Again

```javascript
fetch('/api/auto-apply/process', {
  headers: {
    'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}`
  }
}).then(r => r.json()).then(data => {
  console.log('Updated stats:', data.stats);
  console.log('Pending items:', data.stats.pending);
})
```

You should see `pending: 1` now.

## Step 9: Test Pending Tasks

1. Go to `/dashboard/auto-apply/pending-tasks`
2. You should see the test job we created
3. The task will show as "Form Review" type
4. Click "Go to Job" (opens https://example.com)
5. Click "Task Complete" to mark it done

## Step 10: Test Outcome Recording

1. Go to any job application
2. Click "Record Outcome"
3. Select "Interview"
4. Add a note: "Testing"
5. Click "Record Outcome"
6. You should see success message

## Step 11: Monitor Dashboard

Go to `/dashboard/auto-apply` - you should see:
- ✅ Auto-Apply is Active status
- ✅ Successfully Applied: 1 (the job we marked complete)
- ✅ Pending Tasks: 0 (completed)
- ✅ Charts updating

---

## Next: Configure Real Job Board APIs

Once basic testing works, add real job sources:

### Adzuna Setup

1. Go to https://developer.adzuna.com/
2. Create account and get free API key
3. Add to `.env.local`:
```env
ADZUNA_APP_ID=your-app-id
ADZUNA_APP_KEY=your-app-key
```

4. Restart dev server: `npm run dev`
5. Test from console:
```javascript
const response = await fetch('/api/recommendations/enhanced', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'Software Engineer',
    limit: 10
  })
});
console.log(await response.json());
```

### Other Job Boards

Similar setup for:
- **ZipRecruiter**: https://www.ziprecruiter.com/api
- **RemoteOK**: https://remoteok.io/api
- **GitHub Jobs**: Free RSS feed (no key needed)
- **Glassdoor**: Requires business partnership

---

## Troubleshooting

### Queue items not appearing

```bash
# Check Firestore collections
# Firebase Console → Firestore → users/{uid}/auto-apply-queue
```

### Auto-apply disabled message

```javascript
// Check if enabled
const uid = firebase.auth().currentUser.uid;
const doc = await firebase.firestore()
  .collection(`users/${uid}/settings`)
  .doc('auto-apply')
  .get();
console.log('Config:', doc.data());
```

### Extension not detecting challenges

```javascript
// Send test message to extension
chrome.runtime.sendMessage({
  type: 'DETECT_CHALLENGES'
}, (response) => {
  console.log('Challenges:', response);
});
```

---

## What's Working Now

✅ Auto-apply configuration UI
✅ Queue management
✅ Manual task creation
✅ Pending tasks page
✅ Outcome recording
✅ Analytics dashboard
✅ Extension enhancement
✅ AI personalization (with OpenAI key)
✅ Feedback learning
✅ Multi-source aggregation (with API keys)

---

## What Requires API Keys

These features need external API keys (optional for testing):

| Service | Purpose | Required? | Free Tier |
|---------|---------|-----------|-----------|
| **Adzuna** | Job searches | Optional | Yes (100 req/hr) |
| **ZipRecruiter** | Job searches | Optional | Yes (limited) |
| **RemoteOK** | Remote jobs | Optional | Yes |
| **GitHub Jobs** | Tech jobs | Optional | Yes (RSS) |
| **Glassdoor** | Popular platform | No | Enterprise only |
| **OpenAI** | AI scoring | Optional | Paid ($0.001/1k tokens) |

You can test the entire system WITHOUT any job board APIs by:
1. Creating test queue items manually
2. Using mock recommendations
3. Recording outcomes to test feedback learning

---

## Deploying to Production

Ready to go live? Follow `DEPLOYMENT_CHECKLIST.md`

---

## Need Help?

- **Technical docs**: See `IMPLEMENTATION_GUIDE.md`
- **System overview**: See `IMPLEMENTATION_SUMMARY.md`
- **Troubleshooting**: Check browser console + Firebase logs

---

**You're all set!** 🎉 The auto-apply system is ready to test and deploy.
