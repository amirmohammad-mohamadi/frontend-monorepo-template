import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@components";
import { Link } from "@/i18n/navigation";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home />;
}

function Home() {
  const t = useTranslations("home");
  return (
    <section className="container mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("title")}</h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">{t("subtitle")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/examples">{t("viewExamples")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://github.com" rel="noreferrer">
            {t("readDocs")}
          </a>
        </Button>
      </div>
    </section>
  );
}
