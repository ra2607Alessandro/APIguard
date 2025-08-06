import { Link, useLocation } from "wouter";
import { Shield, BarChart3, FolderOpen, Activity, Settings, Mail, Github, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navItems = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/monitoring", label: "Monitoring", icon: Activity },
  { path: "/github/connect", label: "GitHub", icon: Github },
  { path: "/settings/notifications/email", label: "Email Alerts", icon: Mail },
  { path: "/integrations", label: "Integrations", icon: Settings },
];

export default function Navigation() {
  const [location, setLocation] = useLocation();
  
  const handleLogout = () => {
    localStorage.removeItem("auth-token");
    setLocation("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Shield className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-gray-900">API Sentinel</h1>
            </div>
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <a
                      className={cn(
                        "inline-flex items-center px-1 pt-6 pb-4 text-sm font-medium border-b-2 transition-colors",
                        isActive
                          ? "text-primary border-primary"
                          : "text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-300"
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-3" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      U
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    User
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
