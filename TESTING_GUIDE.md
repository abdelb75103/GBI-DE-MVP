# Paper Assignment System - Quick Testing Guide

## 🎯 Quick Start Testing

### Prerequisites
- Running application (npm run dev)
- At least 2 user profiles created in the system
- Some papers uploaded to test with

---

## 🧪 5-Minute Test Scenario

### Setup: Two Browser Windows

1. **Window A** - Regular browser (e.g., Chrome)
   - Log in as **User A**
   
2. **Window B** - Incognito/Private window
   - Log in as **User B**

---

### Test Flow

#### Step 1: Auto-Assignment (Window A - User A)
```
1. Go to Dashboard
2. Find a paper with "Available" badge (green)
3. Click on the paper title
4. ✅ Should load the paper workspace successfully
5. Go back to Dashboard
6. ✅ Paper should now show "You're working on this" badge (blue)
   ✅ Paper row should have indigo background + left border
```

#### Step 2: Conflict Detection (Window B - User B)
```
1. Go to Dashboard
2. Find the same paper that User A is working on
3. ✅ Should show "Assigned to [User A Name]" badge (grey)
   ✅ Row should be greyed out (50% opacity)
4. Try clicking the paper title
   ✅ Should NOT be clickable (cursor: not-allowed)
5. Click the actions menu (⋯ button)
   ✅ "Open workspace" should show lock icon 🔒
   ✅ Should display: "Assigned to [User A Name]"
6. Try to directly navigate to the paper URL
   (e.g., /paper/[paperId])
   ✅ Should show error page: "Access Restricted"
   ✅ Message: "This paper is currently assigned to [User A Name]"
   ✅ Shows "Back to Dashboard" button
```

#### Step 3: Filter Functionality (Either Window)
```
1. Go to Dashboard
2. Look at filter tabs at top of papers table
3. ✅ Should see counts: "All Papers (X)", "Available (Y)", "My Papers (Z)", etc.
4. Click "Available"
   ✅ Should only show unassigned papers
5. Click "My Papers"
   ✅ Should only show papers assigned to current user
6. Click "Assigned to Others"
   ✅ Should only show papers assigned to other users
7. Click "All Papers"
   ✅ Should show everything again
```

#### Step 4: Session Release (Window A - User A)
```
1. Go back to the paper workspace you opened
2. Click "Back to Dashboard"
3. Click the actions menu (⋯) for that paper
4. Look for a way to release/end session
   (Note: Currently happens automatically when session ends)
5. Alternatively, manually clear assignment in database:
   UPDATE papers SET assigned_to = NULL WHERE id = '[paperId]';
```

#### Step 5: Verify Release (Window B - User B)
```
1. Refresh the Dashboard
2. ✅ The paper should now show "Available" badge again
3. ✅ Should be clickable and fully functional
4. Click on the paper
5. ✅ Should now auto-assign to User B
6. ✅ Should load the workspace successfully
```

---

## 🎨 Visual Checklist

### Assignment Badges
- [ ] **Green** "Available" badge on unassigned papers
- [ ] **Blue** "You're working on this" badge on your papers
- [ ] **Grey** "Assigned to [Name]" badge on others' papers

### Row Styling
- [ ] **Normal**: Available papers - full opacity, white/light background
- [ ] **Highlighted**: Your papers - indigo tint, left border
- [ ] **Greyed Out**: Others' papers - 50% opacity, cursor disabled

### Interactive Elements
- [ ] Available papers: Title link works, checkbox enabled
- [ ] Your papers: Title link works, checkbox enabled
- [ ] Others' papers: Title disabled, checkbox disabled, lock in menu

---

## 📊 Database Verification

To manually check assignments in your database:

```sql
-- See all paper assignments
SELECT 
  p.id,
  p.title,
  p.assigned_to,
  pr.full_name as assignee_name
FROM papers p
LEFT JOIN profiles pr ON p.assigned_to = pr.id
ORDER BY p.uploaded_at DESC;

-- Clear all assignments (for testing)
UPDATE papers SET assigned_to = NULL;

-- Assign a specific paper to a specific user
UPDATE papers 
SET assigned_to = '[profile_id]' 
WHERE id = '[paper_id]';
```

---

## ⚠️ Common Issues & Solutions

### Issue: Paper stays assigned after closing workspace
**Solution**: This is expected! Paper remains assigned until session explicitly ends. 
- To clear: Manually update database, or implement "Release Paper" button

### Issue: Filter counts don't update
**Solution**: Counts update on page load. Refresh the page to see latest counts.

### Issue: Can still access paper via direct URL
**Solution**: This should be blocked! Check that:
1. Server-side check is in place in `/paper/[paperId]/page.tsx`
2. Profile session is active
3. Clear browser cache and try again

### Issue: Error "Select a profile before editing"
**Solution**: Make sure you've selected an active profile:
1. Go to Profile Selection page
2. Choose a profile
3. Try accessing paper again

---

## 🔍 What to Look For (Success Criteria)

### ✅ Success Indicators
- ✅ Papers auto-assign when clicked (no manual button)
- ✅ Assigned papers are clearly visually distinguished
- ✅ Cannot open papers assigned to others
- ✅ Error messages are clear and helpful
- ✅ Filters work and show accurate counts
- ✅ No JavaScript errors in console
- ✅ No linter errors

### ❌ Failure Indicators
- ❌ Can open someone else's assigned paper
- ❌ Papers don't auto-assign when clicked
- ❌ Assignment badges don't show
- ❌ Filters show wrong counts
- ❌ Can bypass restrictions via direct URL
- ❌ Console errors related to assignment

---

## 🎬 Video Testing Script

If recording a demo:

```
"Hi, I'm testing the new paper assignment system.

First, I'll log in as Alice and click on this available paper.
Notice how it opens immediately - that's the auto-assignment feature.

Now when I go back to the dashboard, you can see this paper is 
highlighted and says 'You're working on this'.

Let me open a new incognito window and log in as Bob.
On Bob's dashboard, Alice's paper is greyed out and shows 
'Assigned to Alice'.

If Bob tries to click it... nothing happens. The link is disabled.

And if Bob tries to access it directly via URL...
he gets a clear error message: 'This paper is currently assigned to Alice'.

Finally, let's try the filters. I can view only available papers,
only my papers, or papers assigned to others.

The system is working perfectly - no conflicts possible!"
```

---

## 📞 Questions or Issues?

If you encounter any problems during testing:

1. Check browser console for errors
2. Check server logs for backend errors
3. Verify database state (assignments table)
4. Make sure profiles are properly set up
5. Try clearing browser cache/cookies

**All tests passing? Great! The system is production-ready! 🎉**

