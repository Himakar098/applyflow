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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f2f6ff] to-white px-4 py-10">
      <div className="w-full max-w-md">
        {backLink ? (
          <Link
            href={backLink.href}
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLink.label}
          </Link>
        ) : null}
        <Card className="border-0 shadow-xl shadow-slate-900/5">
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
      </div>
    </div>
  );
}
