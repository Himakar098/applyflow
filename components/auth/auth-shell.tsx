import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/lib/site-config";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  backLink?: { href: string; label: string };
};

export function AuthShell({
  title,
  description,
  children,
  footer,
  backLink,
}: AuthShellProps) {
  return (
    <div
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10"
      role="main"
    >
      <div className="w-full max-w-md space-y-4">
        <Link href="/" className="mx-auto flex w-fit flex-col items-center gap-1 text-center">
          <span className="text-sm font-semibold text-foreground">{siteConfig.name}</span>
          <span className="text-xs text-muted-foreground">{siteConfig.companyName}</span>
        </Link>
        {backLink ? (
          <Link
            href={backLink.href}
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1"
            aria-label={`Back to ${backLink.label}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLink.label}
          </Link>
        ) : null}
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
          {footer ? <CardFooter className="text-sm">{footer}</CardFooter> : null}
        </Card>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link href="/privacy" className="transition hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-foreground">
            Terms
          </Link>
          <Link href={`mailto:${siteConfig.supportEmail}`} className="transition hover:text-foreground">
            {siteConfig.supportEmail}
          </Link>
        </div>
      </div>
    </div>
  );
}
