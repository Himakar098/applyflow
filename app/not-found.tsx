import Link from 'next/link';
import { NotebookIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Page Not Found | ApplyFlow',
  description: 'The page you are looking for could not be found.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="flex flex-col items-center justify-center max-w-md w-full gap-6 text-center">
        {/* 404 Icon */}
        <div className="bg-primary/10 rounded-full p-4">
          <NotebookIcon className="w-8 h-8 text-primary" />
        </div>

        {/* 404 Message */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
            404
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            The page you are looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            asChild
            className="flex-1"
          >
            <Link href="/">
              Go Home
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="flex-1"
          >
            <Link href="/browser-extension">
              Learn More
            </Link>
          </Button>
        </div>

        {/* Suggested Links */}
        <div className="w-full pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-3">Quick links</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              href="/about"
              className="text-xs text-primary hover:underline"
            >
              About
            </Link>
            <span className="text-xs text-muted-foreground">•</span>
            <Link
              href="/resources"
              className="text-xs text-primary hover:underline"
            >
              Resources
            </Link>
            <span className="text-xs text-muted-foreground">•</span>
            <Link
              href="/pricing"
              className="text-xs text-primary hover:underline"
            >
              Pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
