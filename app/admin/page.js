'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#4997d0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#004370] font-medium">Cargando...</p>
      </div>
    </div>
  );
}
