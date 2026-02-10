import { Metadata } from "next";
import ReviewPapersPage from "@/components/pages/ReviewPapers";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Review Papers - SIA",
};

export default function Page({ params }: { params: { id: string } }) {
  return (
    <ProtectedLayout>
      <ReviewPapersPage params={params} />
    </ProtectedLayout>
  );
}
