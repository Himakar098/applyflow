import { DocumentsPanel } from "@/components/job-agent/documents-panel";

export default async function ApplicationDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentsPanel applicationId={id} />;
}

