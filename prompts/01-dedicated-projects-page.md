# Feature #1: Restructure Projects Page — Grouped by Account Manager (Client Group)

## Overview

Restructure the existing `ProjectsPage.tsx` from a flat project list to a **grouped-by-client-group (account manager) layout**, matching the pattern already used on the Clients page (`ClientsPage.tsx`). When a group is expanded, it shows all projects across all clients in that group **directly** (NOT a list of clients — the projects themselves).

## What Already Exists

These files are already in place and working:

- **`client/src/pages/ProjectsPage.tsx`** (246 lines) — Current flat list with search, filters (status/type/client), create/edit/archive. **This is the file to modify.**
- **`client/src/components/ProjectForm.tsx`** — Shared form component with `showClientSelect` prop. Used by both ClientDetailPage and ProjectsPage. **Do not modify.**
- **`client/src/components/BudgetBar.tsx`** — Budget progress bar component. **Reuse as-is.**
- **`client/src/pages/ClientsPage.tsx`** — **Reference implementation** for the grouped layout pattern. Study this file's grouping logic, `expandedGroups` state, `toggleGroup` function, and group header rendering.
- **`client/src/App.tsx`** — Already has `<Route path="projects" element={<ProjectsPage />} />`.
- **`client/src/components/Sidebar.tsx`** and **`client/src/components/BottomNav.tsx`** — Already have Projects nav item.
- **`server/src/routes/projects.ts`** — GET `/api/v1/projects` already returns projects with `client` included and `hoursUsed` aggregated. **Needs a small enhancement** (see backend section below).

## Backend Changes

### Enhance GET `/api/v1/projects` (server/src/routes/projects.ts)

The current `include` in the Prisma query is:
```ts
include: {
  client: true,
  tasks: { where: { isActive: true } },
  _count: { select: { timeEntries: true } },
}
```

Change `client: true` to include the client's group:
```ts
include: {
  client: { include: { group: true } },
  tasks: { where: { isActive: true } },
  _count: { select: { timeEntries: true } },
}
```

This is the **only backend change needed**. Everything else is frontend.

## Frontend Changes — ProjectsPage.tsx

### Updated Interfaces

```ts
interface ClientGroup { id: string; name: string; color: string }
interface ProjectClient {
  id: string; name: string; color: string
  group?: ClientGroup | null
}
interface Task { id: string; name: string; isBillable: boolean }
interface Project {
  id: string; name: string; clientId: string; type: string; recurringPeriod: string
  budgetHours?: number; notes?: string; isActive: boolean; color: string
  client: ProjectClient
  tasks: Task[]
  _count: { timeEntries: number }
  hoursUsed: number
}
```

### New State & Data

Add these (follow `ClientsPage.tsx` patterns):
```ts
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

const { data: groups = [] } = useQuery<ClientGroup[]>({
  queryKey: ['client-groups'],
  queryFn: () => api.get('/client-groups').then(r => r.data),
})
```

### Grouping Logic

Use `useMemo` to group `displayedProjects` by their `client.group.id` (or `'ungrouped'` if the client has no group):

```ts
const grouped = useMemo(() => {
  const map = new Map<string, { group: ClientGroup | null; projects: Project[] }>()

  // Add known groups first (preserves order)
  for (const g of groups) {
    map.set(g.id, { group: g, projects: [] })
  }
  // Ungrouped bucket
  map.set('ungrouped', { group: null, projects: [] })

  for (const p of displayedProjects) {
    const key = p.client.group?.id ?? 'ungrouped'
    if (!map.has(key)) map.set(key, { group: p.client.group ?? null, projects: [] })
    map.get(key)!.projects.push(p)
  }

  // Drop empty buckets
  for (const [key, val] of map) {
    if (val.projects.length === 0) map.delete(key)
  }

  return map
}, [displayedProjects, groups])
```

### Toggle Function

```ts
function toggleGroup(key: string) {
  setExpandedGroups(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })
}
```

### Rendering — Group Headers

Replace the current flat `<div className="space-y-3">` list with the grouped layout. Follow the same card + expandable pattern as `ClientsPage.tsx`:

```
<div className="flex flex-col gap-2">
  {Array.from(grouped.entries()).map(([key, { group, projects: groupProjects }]) => {
    // Compute group-level totals
    const groupHoursUsed = groupProjects.reduce((sum, p) => sum + p.hoursUsed, 0)
    const groupBudget = groupProjects.reduce((sum, p) => sum + (p.budgetHours || 0), 0)
    const groupPct = groupBudget > 0 ? Math.min(100, (groupHoursUsed / groupBudget) * 100) : 0
    const groupColor = group?.color ?? '#a8a29e'
    const groupName = group?.name ?? 'Ungrouped'
    const isExpanded = expandedGroups.has(key)

    return (
      <div key={key} className="card overflow-hidden">
        {/* Group header — clickable to expand/collapse */}
        <button
          type="button"
          onClick={() => toggleGroup(key)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
        >
          <svg
            className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-medium text-stone-900">{groupName}</span>
              <span className="text-xs text-stone-400">
                {groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
            {groupBudget > 0 && (
              <div className="mt-1.5 pr-2">
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${groupPct >= 100 ? 'bg-red-500' : groupPct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${groupPct}%` }}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-0.5">{formatHours(groupHoursUsed)} of {formatHours(groupBudget)} budget</p>
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-mono text-sm font-semibold text-stone-900">{formatHours(groupHoursUsed)}</p>
            <p className="text-xs text-stone-400">total</p>
          </div>
        </button>

        {/* Expanded project rows */}
        {isExpanded && (
          <div className="border-t border-stone-100 divide-y divide-stone-100">
            {/* Render each project card here — see next section */}
          </div>
        )}
      </div>
    )
  })}
</div>
```

### Rendering — Project Rows Inside Expanded Groups

Each project row inside the expanded group should look very similar to the current project cards, but rendered as rows within the group card (indented with `pl-10` like the client rows in `ClientsPage.tsx`):

```
{groupProjects.map(project => {
  const remaining = project.budgetHours != null ? project.budgetHours - project.hoursUsed : null
  const isOver = remaining !== null && remaining < 0
  return (
    <div key={project.id} className={`flex items-center gap-4 pl-10 pr-4 py-3 ${!project.isActive ? 'opacity-60' : ''}`}>
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-blue-700">
            {project.name}
          </Link>
          <span className={`text-xs px-1.5 py-0.5 rounded ${project.type === 'recurring' ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-600'}`}>
            {project.type === 'recurring' ? 'Recurring' : 'One-time'}
          </span>
        </div>
        <Link to={`/clients/${project.clientId}`} className="text-xs text-stone-500 hover:text-stone-700 mt-0.5 block">
          {project.client.name}
        </Link>
        {project.budgetHours != null && (
          <div className="mt-1.5">
            <BudgetBar used={project.hoursUsed} budget={project.budgetHours} showLabel={false} />
            <p className="text-xs text-stone-400 mt-0.5">{formatHours(project.hoursUsed)} used of {project.budgetHours}h</p>
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-sm font-medium text-stone-700">{formatHours(project.hoursUsed)}</p>
        {remaining !== null && (
          <p className={`text-xs ${isOver ? 'text-red-500' : 'text-stone-400'}`}>
            {isOver ? `${formatHours(Math.abs(remaining))} over` : `${formatHours(remaining)} left`}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 border-l border-stone-100 pl-4">
        <button
          onClick={() => setEditProject(project)}
          className="text-xs text-stone-500 hover:text-stone-900 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => archiveProject.mutate({ projectId: project.id, isActive: !project.isActive })}
          className="text-xs text-stone-500 hover:text-stone-900 transition-colors"
        >
          {project.isActive ? 'Archive' : 'Restore'}
        </button>
      </div>
    </div>
  )
})}
```

### Features to Preserve

All of these existing features must still work after the restructure:

1. **Search bar** — Filters projects by name or client name (debounced). Groups with no matching projects should be hidden.
2. **Filters** — Active/Archived toggle, type filter (one-time/recurring), client filter dropdown. All should still work — they filter the project list before grouping.
3. **Create project** — "New project" button opens the modal with `<ProjectForm showClientSelect />`. No changes needed.
4. **Edit project** — Click "Edit" on a project row opens modal with `<ProjectForm>`. No changes needed.
5. **Archive/Restore** — Click "Archive" or "Restore" on a project row. No changes needed.
6. **Budget bars** — Show on projects that have `budgetHours`. No changes needed.
7. **Loading skeleton** — Show 3 skeleton cards while loading.
8. **Empty state** — "No projects found" when no projects match filters.

### What NOT to Change

- Do NOT modify `ProjectForm.tsx`
- Do NOT modify `BudgetBar.tsx`
- Do NOT modify `App.tsx`, `Sidebar.tsx`, or `BottomNav.tsx`
- Do NOT create any new API endpoints — just enhance the existing one
- Do NOT change the project detail page or client detail page

## File Summary

| File | Action |
|------|--------|
| `server/src/routes/projects.ts` | Change `client: true` → `client: { include: { group: true } }` in the GET `/` handler |
| `client/src/pages/ProjectsPage.tsx` | Major restructure: add group fetching, grouping logic, expandable group UI |

## Reference Files (read but don't modify)

- `client/src/pages/ClientsPage.tsx` — Pattern to follow for grouped layout
- `client/src/components/ProjectForm.tsx` — Shared form component
- `client/src/components/BudgetBar.tsx` — Budget progress bar
- `client/src/lib/utils.ts` — Helper functions (`formatHours`, etc.)
- `client/src/lib/api.ts` — Axios instance
- `prisma/schema.prisma` — Database schema showing Client → ClientGroup relationship

## Testing Checklist

After implementing, verify:
- [ ] Projects page loads and shows groups with chevron arrows
- [ ] Clicking a group header expands/collapses to show projects
- [ ] Group headers show: group color dot, group name, project count, aggregate hours, aggregate budget bar (if any projects have budgets)
- [ ] Project rows inside groups show: color dot, project name (links to project detail), type badge, client name (links to client detail), budget bar (if applicable), hours used, edit/archive buttons
- [ ] "Ungrouped" section appears for projects whose clients have no group
- [ ] Search still filters correctly — groups with no matching projects disappear
- [ ] Type filter and client filter still work
- [ ] Active/Archived toggle still works
- [ ] "New project" button + modal still works
- [ ] "Edit" button on project row + modal still works
- [ ] "Archive"/"Restore" button still works
- [ ] Empty state shows when no projects match
- [ ] No TypeScript errors
- [ ] The app builds successfully with `npm run build` (run from `client/` directory)
