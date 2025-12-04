import React from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Users, 
  Megaphone, 
  Heart, 
  Lightbulb, 
  ArrowRight,
  CheckCircle,
  Star
} from 'lucide-react';

const Home = () => {
  const focusAreas = [
    {
      icon: GraduationCap,
      title: 'Inclusive Education for Deaf Children',
      description: 'Providing quality education and learning opportunities for Deaf children across Uganda.'
    },
    {
      icon: Users,
      title: 'Sign Language Training',
      description: 'Comprehensive training programs for individuals and organizations to learn Ugandan Sign Language.'
    },
    {
      icon: Megaphone,
      title: 'Advocacy for Equal Rights',
      description: 'Championing equal rights and opportunities for Deaf and Hard of Hearing individuals.'
    },
    {
      icon: Heart,
      title: 'Community Awareness',
      description: 'Building understanding and acceptance within communities about Deaf culture and communication.'
    },
    {
      icon: Lightbulb,
      title: 'Innovation and Technology',
      description: 'Developing technological solutions to improve accessibility and communication.'
    }
  ];

  const stats = [
    { label: 'Districts Reached', value: '15+' },
    { label: 'People Trained', value: '500+' },
    { label: 'Programs Running', value: '8' },
    { label: 'Years of Impact', value: '2+' }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              Through Sign Language, 
              <span className="text-orange-400"> the Hand Can Speak</span>
            </h1>
            <p className="text-xl lg:text-2xl mb-8 text-blue-100 max-w-4xl mx-auto leading-relaxed">
              We are a Deaf-led organization in Uganda dedicated to promoting Ugandan Sign Language (USL), 
              empowering Deaf and Hard of Hearing individuals, and creating a more inclusive society.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/about"
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg flex items-center space-x-2"
              >
                <span>Learn More</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/donate"
                className="bg-white text-blue-700 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg"
              >
                Donate Now
              </Link>
              <Link
                to="/programs"
                className="border-2 border-white text-white hover:bg-white hover:text-blue-700 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105"
              >
                Join a Program
              </Link>
              <Link
                to="/contact"
                className="border-2 border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105"
              >
                Share Your Story
              </Link>
            </div>
            </div>
            
            {/* Logo Section */}
            <div className="flex justify-center lg:justify-end">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md">
                <img 
                  src="/logo_.jpg" 
                  alt="MCSLI Logo - Through Sign Language, The Hands Can Speak" 
                  className="w-full h-auto rounded-xl shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-blue-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Focus Areas Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Focus Areas</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We work across multiple areas to create lasting impact in the Deaf community and society as a whole.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {focusAreas.map((area, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="bg-blue-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                  <area.icon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{area.title}</h3>
                <p className="text-gray-600 leading-relaxed">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-8">Our Mission</h2>
            <p className="text-2xl text-blue-100 leading-relaxed mb-8">
              To promote Ugandan Sign Language (USL) and empower the Deaf community through education, advocacy, and inclusive opportunities.
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
              <h3 className="text-2xl font-semibold text-orange-400 mb-4">Vision 2040</h3>
              <p className="text-lg text-blue-100 leading-relaxed">
                By 2040, MCSLI aims to eliminate communication barriers in Uganda and East Africa, 
                ensuring that Deaf and Hard of Hearing individuals can fully participate in all sectors 
                of society without limitations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Core Values</h2>
            <p className="text-xl text-gray-600">The principles that guide everything we do</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              'Inclusivity', 'Innovation', 'Teamwork', 'Equality', 'Integrity',
              'Accessibility', 'Connection', 'Empowerment', 'Creativity', 'Impact'
            ].map((value, index) => (
              <div key={index} className="text-center p-6 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{value}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-orange-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">
              Join Us in Creating Change
            </h2>
            <p className="text-xl text-orange-100 mb-8 leading-relaxed">
              Together, we can build a more inclusive society where communication barriers no longer exist. 
              Your support makes a difference in the lives of Deaf and Hard of Hearing individuals across Uganda.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/programs"
                className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg"
              >
                Join Our Programs
              </Link>
              <Link
                to="/team"
                className="border-2 border-white text-white hover:bg-white hover:text-orange-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105"
              >
                Volunteer With Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;