import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Heart, 
  Users,
  CheckCircle,
  Send
} from 'lucide-react';

const Team = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    skills: '',
    availability: '',
    motivation: '',
    experience: ''
  });

  const keyPersonnel = [
    {
      name: 'Ssenyonjo Jim Maurice',
      position: 'Founder & Executive Director',
      description: 'Visionary leader dedicated to empowering the Deaf community and promoting inclusive communication.',
      image: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2'
    },
    {
      name: 'Bukenya Eric Paul',
      position: 'Program Coordinator',
      description: 'Manages and oversees all program activities, ensuring quality delivery and community impact.',
      image: 'https://images.pexels.com/photos/3778876/pexels-photo-3778876.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2'
    },
    {
      name: 'Mulindwa Max',
      position: 'Treasurer',
      description: 'Responsible for financial management and ensuring transparent use of resources.',
      image: 'https://images.pexels.com/photos/3771149/pexels-photo-3771149.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2'
    },
    {
      name: 'Kakooza Peter',
      position: 'General Secretary',
      description: 'Handles administrative duties and maintains organizational records and communications.',
      image: 'https://images.pexels.com/photos/2897883/pexels-photo-2897883.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&dpr=2'
    }
  ];

  const otherMembers = [
    {
      name: 'Ochen Morris',
      position: 'Graphic Designer',
      description: 'Creates visual content and designs that support our communication and awareness efforts.'
    },
    {
      name: 'Iraguha Emmanuel',
      position: 'Partnership & Communications Officer',
      description: 'Manages partnerships and handles external communications and media relations.'
    },
    {
      name: 'Nakato Lilian',
      position: 'Sign Language Trainer',
      description: 'Expert instructor providing high-quality Ugandan Sign Language training to our participants.'
    }
  ];

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
    alert('Thank you for your interest! We will contact you soon.');
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      country: '',
      skills: '',
      availability: '',
      motivation: '',
      experience: ''
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Our Team</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              Meet the dedicated individuals working to empower the Deaf community and create a more inclusive Uganda
            </p>
          </div>
        </div>
      </section>

      {/* Key Personnel */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Leadership Team</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our experienced leadership team brings together diverse skills and deep commitment to our mission
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {keyPersonnel.map((person, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className="aspect-square overflow-hidden">
                  <img 
                    src={person.image} 
                    alt={person.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{person.name}</h3>
                  <p className="text-blue-600 font-medium mb-3">{person.position}</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{person.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other Team Members */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Team Members</h2>
            <p className="text-xl text-gray-600">
              Talented professionals supporting our programs and operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {otherMembers.map((member, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{member.name}</h3>
                  <p className="text-blue-600 font-medium mb-4">{member.position}</p>
                  <p className="text-gray-600 leading-relaxed">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Volunteer & Internship Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Join Our Team</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                We welcome volunteers and interns from Uganda and around the world who share our passion 
                for creating an inclusive society. Join us in making a meaningful impact in the Deaf community.
              </p>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
                    <Heart className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Volunteer Opportunities</h3>
                    <p className="text-gray-600">Support our programs, community outreach activities, and help us reach more people across Uganda.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Internship Programs</h3>
                    <p className="text-gray-600">Gain valuable experience while contributing to meaningful projects that advance our mission.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                    <Globe className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">International Welcome</h3>
                    <p className="text-gray-600">We welcome applications from both Ugandan and international volunteers and interns.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Form */}
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Volunteer & Internship Application</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>

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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="+256 xxx xxx xxx"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                    Country *
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    required
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Your country"
                  />
                </div>

                <div>
                  <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-2">
                    Skills / Area of Interest *
                  </label>
                  <input
                    type="text"
                    id="skills"
                    name="skills"
                    required
                    value={formData.skills}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="e.g., Education, Technology, Communications, etc."
                  />
                </div>

                <div>
                  <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-2">
                    Availability *
                  </label>
                  <select
                    id="availability"
                    name="availability"
                    required
                    value={formData.availability}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select availability</option>
                    <option value="part-time">Part-time (10-20 hours/week)</option>
                    <option value="full-time">Full-time (40+ hours/week)</option>
                    <option value="weekends">Weekends only</option>
                    <option value="flexible">Flexible schedule</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="motivation" className="block text-sm font-medium text-gray-700 mb-2">
                    Motivation / Why do you want to volunteer or intern? *
                  </label>
                  <textarea
                    id="motivation"
                    name="motivation"
                    required
                    rows={4}
                    value={formData.motivation}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical"
                    placeholder="Tell us what motivates you to join our mission..."
                  />
                </div>

                <div>
                  <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-2">
                    Previous Experience (if any)
                  </label>
                  <textarea
                    id="experience"
                    name="experience"
                    rows={3}
                    value={formData.experience}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical"
                    placeholder="Describe any relevant experience you have..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <Send className="h-5 w-5" />
                  <span>Submit Application</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Team;