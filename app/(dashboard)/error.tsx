'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center justify-center max-w-md w-full gap-6 text-center">
        {/* Error Icon */}
        <div className="bg-destructive/10 rounded-full p-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Oops! Something went wrong
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            We encountered an error in your dashboard. Please try again or return to the main dashboard.
          </p>
        </div>

        {/* Error Details (Development only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="w-full bg-muted p-3 rounded-lg text-left">
            <p className="text-xs text-muted-foreground font-mono break-words">
              {error.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            onClick={reset}
            className="flex-1"
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            asChild
            className="flex-1"
          >
            <Link href="/dashboard">
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
