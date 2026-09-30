import type { CategoryNode } from '@pe/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';
import { getCategoryTree } from '@/lib/catalog/api';

export const metadata: Metadata = {
  title: t.catalog.allCategories,
  alternates: { canonical: '/categories' },
};

export default async function CategoriesPage() {
  const tree = await getCategoryTree();
  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.catalog.categories }]} />
      </div>
      <h1 className="mb-6 text-2xl font-bold">{t.catalog.allCategories}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((root) => (
          <CategoryPanel key={root.id} node={root} />
        ))}
      </div>
    </Container>
  );
}

function CategoryPanel({ node }: { node: CategoryNode }) {
  const image = assetUrl(node.imageUrl);
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <Link
        href={`/categories/${node.slug}`}
        className="flex items-center gap-3 font-bold hover:text-brand-700"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-lg object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700"
          >
            {node.name.slice(0, 1)}
          </span>
        )}
        {node.name}
      </Link>
      {node.children.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {node.children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/categories/${child.slug}`}
                className="text-ink-muted hover:text-brand-700"
              >
                {child.name}
              </Link>
              {child.children.length > 0 ? (
                <ul className="ms-3 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {child.children.map((leaf) => (
                    <li key={leaf.id}>
                      <Link
                        href={`/categories/${leaf.slug}`}
                        className="text-ink-muted hover:text-brand-700"
                      >
                        {leaf.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
