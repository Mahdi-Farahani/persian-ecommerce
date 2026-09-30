import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

export function ContentPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Container className="py-8">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: title }]} />
      </div>
      <article className="mx-auto flex max-w-3xl flex-col gap-5 rounded-card border border-border bg-surface p-6 leading-8 sm:p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {children}
      </article>
    </Container>
  );
}
