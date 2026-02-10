import { Metadata } from "next";
import TagReportsPage from "@/components/pages/TagReports";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Tag Reports - SIA",
};

export default function Page({ params }: { params: { id: string } }) {
  return (
    <ProtectedLayout>
      <TagReportsPage params={params} />
    </ProtectedLayout>
  );
}
