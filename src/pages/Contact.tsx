import React, { useState } from 'react';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Send,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  MessageCircle,
  Navigation,
  Building2
} from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    inquiry: 'general'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log('Form submitted:', formData);
    alert('Thank you for your message! We will get back to you soon.');
    setFormData({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      inquiry: 'general'
    });
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Our Location',
      details: 'Plot 254, Sir Apollo Kaggwa Road, Makerere, Kampala, Uganda',
      action: 'Get Directions',
      color: 'bg-blue-500'
    },
    {
      icon: Phone,
      title: 'Phone Number',
      details: '0701806993',
      subdetails: 'WhatsApp & SMS Available',
      action: 'Call Now',
      color: 'bg-green-500'
    },
    {
      icon: Mail,
      title: 'Email Address',
      details: 'mclass394@gmail.com',
      subdetails: 'We respond within 24 hours',
      action: 'Send Email',
      color: 'bg-orange-500'
    }
  ];

  const workingHours = [
    { day: 'Monday - Friday', hours: '8:00 AM - 5:00 PM' },
    { day: 'Saturday', hours: '9:00 AM - 1:00 PM' },
    { day: 'Sunday', hours: 'Closed' }
  ];

  const socialLinks = [
    { icon: Facebook, name: 'Facebook', url: '#', color: 'hover:text-blue-600' },
    { icon: Twitter, name: 'Twitter', url: '#', color: 'hover:text-blue-400' },
    { icon: Instagram, name: 'Instagram', url: '#', color: 'hover:text-pink-600' },
    { icon: Youtube, name: 'YouTube', url: '#', color: 'hover:text-red-600' }
  ];

  const inquiryTypes = [
    { value: 'general', label: 'General Information' },
    { value: 'training', label: 'Training Programs' },
    { value: 'volunteer', label: 'Volunteer Opportunities' },
    { value: 'donation', label: 'Donations' },
    { value: 'partnership', label: 'Partnerships' },
    { value: 'media', label: 'Media Inquiries' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Contact Us</h1>
            <p className="text-xl text-green-100 max-w-3xl mx-auto leading-relaxed">
              We'd love to hear from you! Whether you have questions, want to get involved, 
              or need support, our team is here to help you connect with our mission.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Information Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {contactInfo.map((info, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 text-center">
                <div className={`${info.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6`}>
                  <info.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{info.title}</h3>
                <p className="text-gray-600 mb-2 leading-relaxed">{info.details}</p>
                {info.subdetails && (
                  <p className="text-sm text-gray-500 mb-4">{info.subdetails}</p>
                )}
                <button className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200">
                  {info.action}
                </button>
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        placeholder="+256 xxx xxx xxx"
                      />
                    </div>
                    <div>
                      <label htmlFor="inquiry" className="block text-sm font-medium text-gray-700 mb-2">
                        Type of Inquiry *
                      </label>
                      <select
                        id="inquiry"
                        name="inquiry"
                        required
                        value={formData.inquiry}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      >
                        {inquiryTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="What is your message about?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-vertical"
                      placeholder="Tell us more about your inquiry..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Send className="h-5 w-5" />
                    <span>Send Message</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Working Hours */}
              <div className="bg-gray-50 rounded-xl p-8">
                <div className="flex items-center mb-6">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Working Hours</h3>
                </div>
                <div className="space-y-3">
                  {workingHours.map((schedule, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-gray-600">{schedule.day}</span>
                      <span className="font-medium text-gray-900">{schedule.hours}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Media */}
              <div className="bg-gray-50 rounded-xl p-8">
                <div className="flex items-center mb-6">
                  <div className="bg-purple-100 p-2 rounded-lg mr-3">
                    <MessageCircle className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Follow Us</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Stay connected with our latest updates and community activities.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.url}
                      className={`flex items-center space-x-3 text-gray-600 ${social.color} transition-colors duration-200 p-3 rounded-lg hover:bg-white`}
                    >
                      <social.icon className="h-5 w-5" />
                      <span className="font-medium">{social.name}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div className="bg-gray-50 rounded-xl p-8">
                <div className="flex items-center mb-6">
                  <div className="bg-orange-100 p-2 rounded-lg mr-3">
                    <Navigation className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Quick Links</h3>
                </div>
                <div className="space-y-3">
                  <a href="/programs" className="block text-blue-600 hover:text-blue-800 transition-colors duration-200">
                    Join Our Programs
                  </a>
                  <a href="/volunteer" className="block text-blue-600 hover:text-blue-800 transition-colors duration-200">
                    Volunteer with Us
                  </a>
                  <a href="/donate" className="block text-blue-600 hover:text-blue-800 transition-colors duration-200">
                    Make a Donation
                  </a>
                  <a href="/events" className="block text-blue-600 hover:text-blue-800 transition-colors duration-200">
                    Upcoming Events
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Find Us</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Visit us at our office in Makerere, Kampala for in-person consultations and program information
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3">
              <div className="bg-gray-100 p-8 lg:p-12">
                <div className="flex items-center mb-6">
                  <div className="bg-green-500 p-3 rounded-lg mr-4">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900">Our Office</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Address:</h4>
                    <p className="text-gray-600 leading-relaxed">
                      Plot 254, Sir Apollo Kaggwa Road<br />
                      Makerere, Kampala<br />
                      Uganda
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Registration:</h4>
                    <p className="text-gray-600">
                      Uganda Registration Services Bureau (URSB)<br />
                      Registration #: 80034987295030
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg flex items-center space-x-2">
                      <Navigation className="h-5 w-5" />
                      <span>Get Directions</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-2 bg-gray-200 flex items-center justify-center min-h-96">
                <div className="text-center text-gray-500">
                  <MapPin className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-lg">Interactive Map</p>
                  <p className="text-sm">Map integration would be implemented here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;