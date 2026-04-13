export const COMPLAINT_NAV = [
  {
    section: "Main",
    items: [{ label: "Overview", icon: "⬛", href: "/complaint" }],
  },
  {
    section: "Complaints",
    items: [
      { label: "All Complaints", icon: "📋", href: "/complaint/complaints" },
      {
        label: "My Assignments",
        icon: "👤",
        href: "/complaint/complaints/assigned",
      },
      { label: "By Status", icon: "🔍", href: "/complaint/complaints/status" },
      { label: "Complaint Report", icon: "📊", href: "/complaint/report" },
    ],
  },
];

export const COMPLAINT_PAGE_META = {
  "/complaint": {
    title: "Overview",
    sub: "Welcome back, Complaint Officer",
    action: "",
  },
  "/complaint/complaints": {
    title: "All Complaints",
    sub: "All complaints under your woreda",
    action: "",
  },
  "/complaint/complaints/assigned": {
    title: "My Assignments",
    sub: "Complaints assigned to you",
    action: "",
  },
  "/complaint/complaints/status": {
    title: "By Status",
    sub: "Filter complaints by status",
    action: "",
  },
  "/complaint/report": {
    title: "Complaint Report",
    sub: "Complaint performance in your assigned area",
    action: "",
  },
};
