import ClassManagement from '@/components/pages/ClassManagement';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export default function ClassesPage() {
  return (
    <ProtectedLayout>
      <ClassManagement />
    </ProtectedLayout>
  );
}
