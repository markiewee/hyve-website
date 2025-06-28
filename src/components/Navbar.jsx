import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import hyveGreenLogo from '../assets/hyve_green.png';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Properties', href: '/properties' },
    { name: 'Locations', href: '/locations' },
    { name: 'About', href: '/about' },
    { name: 'FAQs', href: '/faqs' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={hyveGreenLogo} 
              alt="Hyve Logo" 
              className="w-8 h-8"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => {
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-teal-600'
                      : 'text-gray-700 hover:text-teal-600'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <a href="https://wa.me/6580885410?text=I%20would%20love%20to%20join%20the%20hyve%20community" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </Button>
            </a>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
              Find a Home
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
              {navigation.map((item) => {
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive(item.href)
                        ? 'text-teal-600'
                        : 'text-gray-700 hover:text-teal-600'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-4 space-y-2">
                <a href="https://wa.me/6580885410?text=I%20would%20love%20to%20join%20the%20hyve%20community" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full justify-center">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </a>
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  Find a Home
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

