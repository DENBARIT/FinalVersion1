export const WOREDA_NAV = [
  {
    section: "Main",
    items: [{ label: "Overview", icon: "⬛", href: "/woreda" }],
  },
  {
    section: "Management",
    items: [
      { label: "Field Officers", icon: "👷", href: "/woreda/officers" },
      {
        label: "Billing Officers",
        icon: "💳",
        href: "/woreda/officers/billing",
      },
      {
        label: "Complaint Officers",
        icon: "📝",
        href: "/woreda/officers/complaint",
      },
    ],
  },
  {
    section: "Users",
    items: [{ label: "Customers", icon: "👥", href: "/woreda/customers" }],
  },
  {
    section: "Reports",
    items: [
      {
        label: "Customer Report",
        icon: "📊",
        href: "/woreda/reports/customers",
      },
    ],
  },
];

export const WOREDA_PAGE_META = {
  "/woreda": {
    title: "Overview",
    sub: "Welcome back, Woreda Admin",
    action: "",
  },
  "/woreda/officers": {
    title: "Field Officers",
    sub: "Manage billing and complaint officers",
    action: "+ Add Officer",
  },
  "/woreda/officers/billing": {
    title: "Billing Officers",
    sub: "Manage billing officers under your woreda",
    action: "+ Add Officer",
  },
  "/woreda/officers/complaint": {
    title: "Complaint Officers",
    sub: "Manage complaint officers under your woreda",
    action: "+ Add Officer",
  },
  "/woreda/customers": {
    title: "Customers",
    sub: "View customers under your woreda",
    action: "Export CSV",
  },
  "/woreda/reports/customers": {
    title: "Customer Report",
    sub: "Customer overview for your woreda",
    action: "",
  },
};
