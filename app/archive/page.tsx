import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import Archive from "@/components/pages/Archive";

export const metadata = {
  title: "Archive - SIA",
};

export default function ArchivePage() {
  return (
    <ProtectedLayout>
      <Archive />
    </ProtectedLayout>
  );
}
