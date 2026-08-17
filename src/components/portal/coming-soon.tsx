import { PageHero } from "@/components/portal/page-hero";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoonPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHero title={title} subtitle={subtitle} />
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          This page is being built next in the rollout. Check back soon.
        </CardContent>
      </Card>
    </div>
  );
}
