
# Fix Kanban column cards getting cut off

## Problem
The Kanban column body uses `max-h-[calc(100vh-300px)]` which doesn't account for the actual page layout (sidebar, header, stats cards, tabs). This causes cards at the bottom of each column to be clipped and not fully visible.

## Solution
Adjust the `max-h` calculation in `src/components/ugc/UgcKanbanBoard.tsx` to properly account for all elements above the Kanban board:
- Page header (~64px)
- Stats cards (~100px)  
- Tabs bar (~48px)
- Column header (~48px)
- Padding/gaps (~40px)

Total offset: ~350-380px

## Change
In `src/components/ugc/UgcKanbanBoard.tsx`, line 87:

**Before:**
```
max-h-[calc(100vh-300px)]
```

**After:**
```
max-h-[calc(100vh-380px)]
```

Also remove `min-h-[500px]` from the column container (line 69) since it forces columns to be taller than needed when there are few cards, and can conflict with the max-height causing layout issues.

This single file change ensures all cards render fully visible within each column's scrollable area.
