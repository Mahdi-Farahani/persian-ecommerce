import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Container className="flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </Container>
  );
}
