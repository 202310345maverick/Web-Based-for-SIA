import { Metadata } from "next";
import ExamDetails from "@/components/pages/ExamDetails";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Exam Details - SIA",
};

export default function ExamDetailPage({ params }: { params: { id: string } }) {
  return (
    <ProtectedLayout>
      <ExamDetails params={params} />
    </ProtectedLayout>
  );
}
