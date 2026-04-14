

## Plan: Change "Back to Home" to Navigate Back

### Problem
The "BACK TO HOME" button in the Office sidebar always navigates to `/home`. The user wants it to return to the page they came from instead.

### Changes

**`src/components/office/OfficeSidebar.tsx`**
- Import `useNavigate` from `react-router-dom`
- Replace the `<Link to="/home">` with a `<button onClick={() => navigate(-1)}>` that goes back one step in browser history
- Update label from "Back to Home" to "Back"

### Result
Clicking the back button returns the user to whatever page they were on before entering the Office tools.

