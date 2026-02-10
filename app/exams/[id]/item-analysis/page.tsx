import { Metadata } from "next";
import ItemAnalysisPage from "@/components/pages/ItemAnalysis";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Item Analysis - SIA",
};

export default function Page({ params }: { params: { id: string } }) {
  return (
    <ProtectedLayout>
      <ItemAnalysisPage params={params} />
    </ProtectedLayout>
  );
}
