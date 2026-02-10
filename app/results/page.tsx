import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import Results from "@/components/pages/Results";

export const metadata = {
  title: "Results - SIA",
};

export default function ResultsPage() {
  return (
    <ProtectedLayout>
      <Results />
    </ProtectedLayout>
  );
}
