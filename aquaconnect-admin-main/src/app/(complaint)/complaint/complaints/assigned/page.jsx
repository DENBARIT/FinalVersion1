import ComplaintsPage from "@/features/complaint/components/ComplaintsPage";
export default function AssignedComplaintsPage() {
  return (
    <ComplaintsPage assignedOnly fixedStatus="OPEN" title="My Assignments" />
  );
}
