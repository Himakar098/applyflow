"use client";

import { useRouter } from "next/navigation";
import { User } from "firebase/auth";
import { LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/auth-provider";

type UserNavProps = {
  user: User | null;
};

export function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { signOut } = useAuth();

  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("") ?? "AF";

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out" });
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-2 py-1 pr-3 text-left shadow-[0_12px_30px_-20px_rgba(14,22,37,0.45)] transition hover:-translate-y-[1px]">
        <Avatar className="h-9 w-9">
          <AvatarImage src={user?.photoURL ?? undefined} alt={user?.email ?? ""} />
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-tight">
            {user?.displayName ?? "ApplyFlow user"}
          </p>
          <p className="text-xs text-muted-foreground leading-tight">
            {user?.email ?? "Signed in"}
          </p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="font-medium">{user?.displayName ?? "ApplyFlow user"}</p>
          <p className="text-xs text-muted-foreground">
            {user?.email ?? "No email on file"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
