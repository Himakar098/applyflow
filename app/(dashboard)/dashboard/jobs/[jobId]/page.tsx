import { redirect } from "next/navigation";

export default function DashboardJobRedirect({ params }: { params: { jobId: string } }) {
  redirect(`/jobs/${params.jobId}`);
}
