import React from 'react';
import { Link } from 'react-router-dom';
import { HandMetal, Facebook, Twitter, Instagram, Youtube, MapPin, Phone, Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Organization Info */}
          <div className="col-span-1 lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-blue-600 p-2 rounded-lg">
                <HandMetal className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">MCSLI</h3>
                <p className="text-sm text-gray-300">Through Sign Language, the Hand Can Speak</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed">
              We are a Deaf-led organization in Uganda dedicated to promoting Ugandan Sign Language (USL), 
              empowering Deaf and Hard of Hearing individuals, and creating a more inclusive society.
            </p>
            <p className="text-orange-400 font-medium mb-4">
              "Empowering the Deaf, Connecting Communities, Inspiring Change."
            </p>
            {/* Social Links */}
            <div className="flex space-x-4">
              <a href="#" className="text-gray-300 hover:text-blue-400 transition-colors duration-200">
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-300 hover:text-blue-400 transition-colors duration-200">
                <Twitter className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-300 hover:text-blue-400 transition-colors duration-200">
                <Instagram className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-300 hover:text-blue-400 transition-colors duration-200">
                <Youtube className="h-6 w-6" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors duration-200">About Us</Link></li>
              <li><Link to="/programs" className="text-gray-300 hover:text-white transition-colors duration-200">Programs</Link></li>
              <li><Link to="/team" className="text-gray-300 hover:text-white transition-colors duration-200">Our Team</Link></li>
              <li><Link to="/events" className="text-gray-300 hover:text-white transition-colors duration-200">Events</Link></li>
              <li><Link to="/donate" className="text-gray-300 hover:text-white transition-colors duration-200">Donate</Link></li>
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors duration-200">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-gray-300 text-sm">
                  Plot 254, Sir Apollo Kaggwa Road, Makerere, Kampala, Uganda
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <p className="text-gray-300 text-sm">0701806993</p>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <p className="text-gray-300 text-sm">mclass394@gmail.com</p>
              </div>
            </div>
            <div className="mt-6">
              <h4 className="font-medium mb-2">Working Hours:</h4>
              <p className="text-gray-300 text-sm">Monday - Friday: 8:00 AM - 5:00 PM</p>
              <p className="text-gray-300 text-sm">Saturday: 9:00 AM - 1:00 PM</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 Master Class Sign Language Initiative (MCSLI). All Rights Reserved.
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Registration Number: 80034987295030
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;