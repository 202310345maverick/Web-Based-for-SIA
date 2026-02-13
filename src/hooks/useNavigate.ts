import { useRouter } from 'next/navigation';

// Hook for use-client components to use Next.js routing
export function useNavigate() {
  const router = useRouter();
  
  return (path: string) => {
    router.push(path);
  };
}
