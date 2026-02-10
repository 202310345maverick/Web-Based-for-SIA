import { Metadata } from "next";
import AnswerKeyEditor from "@/components/pages/AnswerKeyEditor";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Edit Answer Key - SIA",
};

export default function EditKeyPage({ params }: { params: { id: string } }) {
  return (
    <ProtectedLayout>
      <AnswerKeyEditor params={params} />
    </ProtectedLayout>
  );
}
