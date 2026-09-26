import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { CertificationArticleCard } from "@/components/certification-article-card";
import { Hero } from "@/components/hero";
import { PostCard } from "@/components/post-card";
import { PrincipleCard } from "@/components/principle-card";
import { SearchBox } from "@/components/search-box";
import { format, getDictionary } from "@/lib/dictionaries";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { isLocale, localePath } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";
import { getAllPrinciples } from "@/lib/principles";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const posts = getAllPostSummaries(lang).slice(0, 3);
  const allPrinciples = getAllPrinciples(lang);
  const principles = allPrinciples.filter((p) => !p.isWip).slice(0, 3);
  const certifications = getAllCertificationSummaries(lang).slice(0, 3);

  return (
    <>
      <Hero locale={lang} dict={dict} />

      <Container className="relative pt-4">
        <SearchBox locale={lang} labels={dict.search} />
      </Container>

      {posts.length > 0 && (
        <Container className="py-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">{dict.home.latestPosts}</h2>
            <Link
              href={localePath(lang, "/blog")}
              className="text-sm text-accent hover:underline"
            >
              {dict.home.viewAll}
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} locale={lang} dict={dict} />
            ))}
          </div>
        </Container>
      )}

      {principles.length > 0 && (
        <Container className={posts.length > 0 ? "pb-24" : "py-24"}>
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{dict.home.principlesTitle}</h2>
              <p className="mt-1 text-sm text-muted">{dict.home.principlesSubtitle}</p>
            </div>
            <Link
              href={localePath(lang, "/principles")}
              className="shrink-0 text-sm text-accent hover:underline"
            >
              {format(dict.home.allPrinciples, { count: allPrinciples.length })}
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle) => (
              <PrincipleCard
                key={principle.key}
                principle={principle}
                locale={lang}
                dict={dict}
                showCategory
              />
            ))}
          </div>
        </Container>
      )}

      {certifications.length > 0 && (
        <Container className={posts.length > 0 || principles.length > 0 ? "pb-24" : "py-24"}>
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">{dict.home.certificationsTitle}</h2>
              <p className="mt-1 text-sm text-muted">{dict.home.certificationsSubtitle}</p>
            </div>
            <Link
              href={localePath(lang, "/certifications")}
              className="shrink-0 text-sm text-accent hover:underline"
            >
              {dict.home.viewAll}
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {certifications.map((article) => (
              <CertificationArticleCard
                key={article.slug}
                article={article}
                locale={lang}
                dict={dict}
              />
            ))}
          </div>
        </Container>
      )}
    </>
  );
}
