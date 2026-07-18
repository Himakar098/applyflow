import { AnswersPanel } from "@/components/job-agent/answers-panel";

export default async function ApplicationAnswersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnswersPanel applicationId={id} />;
}

