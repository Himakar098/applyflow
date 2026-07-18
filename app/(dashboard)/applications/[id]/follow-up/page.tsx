import { FollowUpMaterials } from "@/components/job-agent/follow-up-materials";

export default async function ApplicationFollowUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FollowUpMaterials applicationId={id} />;
}
