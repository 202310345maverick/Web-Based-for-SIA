'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Scroll,
  Archive,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/exams', label: 'Exams', icon: FileText },
  { path: '/classes', label: 'Classes', icon: Users },
  { path: '/results', label: 'Results', icon: BarChart3 },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/archive', label: 'Archive', icon: Archive },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarContext();

  const handleSignOut = () => {
    signOut();
    setMobileOpen(false);
    router.push('/');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when a link is clicked
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b z-50 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 hover:bg-muted rounded-md"
        >
          {mobileOpen ? <X className="w-5 h-5 text-sidebar-foreground" /> : <Menu className="w-5 h-5 text-sidebar-foreground" />}
        </button>
        <h1 className="ml-3 font-bold text-sidebar-foreground">SIA</h1>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "h-screen bg-sidebar flex flex-col transition-all duration-300 fixed left-0 top-0 z-40 border-r",
          // Desktop
          "hidden md:flex",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sidebar-foreground">SIA</h1>
              <p className="text-xs text-sidebar-foreground/60 truncate">Exam & Quiz Builder</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || 
                            pathname.startsWith(item.path + '/');
            
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "sidebar-item",
                  isActive && "sidebar-item-active"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          {!collapsed && user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="sidebar-item w-full text-left hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border bg-card shadow-sm hover:bg-secondary"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </Button>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={cn(
          "md:hidden h-screen bg-sidebar flex flex-col fixed left-0 top-14 z-40 border-r w-64 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || 
                            pathname.startsWith(item.path + '/');
            
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={handleNavClick}
                className={cn(
                  "sidebar-item",
                  isActive && "sidebar-item-active"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="sidebar-item w-full text-left hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
