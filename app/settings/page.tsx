import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import Settings from "@/components/pages/Settings";

export const metadata = {
  title: "Settings - SIA",
};

export default function SettingsPage() {
  return (
    <ProtectedLayout>
      <Settings />
    </ProtectedLayout>
  );
}
