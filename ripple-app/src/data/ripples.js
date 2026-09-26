export const categories = [
  "Transportation",
  "Roads",
  "Accessibility",
  "Public spaces",
  "Waste",
  "Safety",
  "Other",
];
export const categoryIcons = [
  "imgBusFront",
  "imgConstruction",
  "imgAccessibility1",
  "imgTrees",
  "imgTrash2",
  "imgShieldCheck",
  "imgShapes",
];
export const ripples = [
  {
    id: "route-7",
    title: "Route 7 overcrowding",
    location: "Route 7 · Downtown",
    voices: 137,
    category: "Transportation",
    status: "Under review",
    tone: "amber",
    updated: "today",
    icon: "imgBusFront1",
  },
  {
    id: "bank-street",
    title: "Potholes on Bank Street",
    location: "Centretown",
    voices: 84,
    category: "Roads",
    status: "Repairs scheduled",
    tone: "teal",
    updated: "yesterday",
    icon: "imgConstruction1",
  },
  {
    id: "library",
    title: "Library entrance ramp is blocked",
    location: "Westside Library",
    voices: 42,
    category: "Accessibility",
    status: "City reviewing",
    tone: "blue",
    updated: "2 days ago",
    icon: "imgAccessibility2",
  },
  {
    id: "park",
    title: "Lighting needed near Riverside Park",
    location: "Riverside",
    voices: 68,
    category: "Public spaces",
    status: "Community Ripple detected",
    tone: "blue",
    updated: "3 days ago",
    icon: "imgLampDesk",
  },
  {
    id: "waste",
    title: "Garbage collection delays",
    location: "North End",
    voices: 61,
    category: "Waste",
    status: "Action announced",
    tone: "teal",
    updated: "4 days ago",
    icon: "imgTrash3",
  },
  {
    id: "crosswalk",
    title: "Crosswalk timing is too short",
    location: "Main & Cedar",
    voices: 35,
    category: "Safety",
    status: "Reports gathering",
    tone: "amber",
    updated: "this week",
    icon: "imgTrafficCone",
  },
];
// Local preview only. Preserve the user's words rather than claiming AI analysis.
export function prepareReview(draft) {
  return {
    issue: draft.text.trim(),
    location: draft.location.trim() || "Not specified",
    time: "Not specified",
    category: draft.category || "Other",
  };
}
export function filterRipples(items, query, category) {
  const term = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      (!category || item.category === category) &&
      `${item.title} ${item.location} ${item.category}`
        .toLowerCase()
        .includes(term),
  );
}
