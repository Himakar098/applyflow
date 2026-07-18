import { AutofillConsole } from "@/components/job-agent/autofill-console";

export default async function ApplicationAutofillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AutofillConsole applicationId={id} />;
}

