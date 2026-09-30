'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth-store';

export function LogoutAllButton() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await browserApi.post('/auth/logout-all', {});
    } finally {
      setUser(null);
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <Button variant="danger" loading={loading} onClick={onClick}>
      {t.account.logoutAll}
    </Button>
  );
}
