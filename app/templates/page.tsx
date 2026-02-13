import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import Templates from "@/components/pages/Templates";

export const metadata = {
  title: "Templates - SIA",
};

export default function TemplatesPage() {
  return (
    <ProtectedLayout>
      <Templates />
    </ProtectedLayout>
  );
}
