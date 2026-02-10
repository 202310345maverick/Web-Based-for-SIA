import { Metadata } from "next";
import Students from "@/components/pages/Students";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Students - GradePrep",
};

export default function StudentsPage() {
  return (
    <ProtectedLayout>
      <Students />
    </ProtectedLayout>
  );
}
