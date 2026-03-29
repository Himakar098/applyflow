import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Page Not Found | ApplyFlow Dashboard',
  description: 'The dashboard page you are looking for could not be found.',
};

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center justify-center max-w-md w-full gap-6 text-center">
        {/* 404 Icon */}
        <div className="bg-primary/10 rounded-full p-4">
          <AlertCircle className="w-8 h-8 text-primary" />
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
            The dashboard page you&apos;re looking for doesn&apos;t exist. Check the URL or navigate using the menu.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            asChild
            className="flex-1"
          >
            <Link href="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="flex-1"
          >
            <Link href="/">
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
