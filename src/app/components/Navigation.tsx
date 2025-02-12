import Link from 'next/link';
import { Inbox, Filter, CheckCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { 
      label: 'Inbox', 
      icon: Inbox, 
      href: '/',
      isActive: pathname === '/'
    },
    { 
      label: 'Filter Rules', 
      icon: Filter, 
      href: '/rules',
      isActive: pathname === '/rules'
    },
    { 
      label: 'Processed', 
      icon: CheckCircle, 
      href: '/processed',
      isActive: pathname === '/processed'
    }
  ];

  return (
    <nav className="h-full bg-gray-50 border-r">
      <div className="px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md mb-1',
              item.isActive
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
} 