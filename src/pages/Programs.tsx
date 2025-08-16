import React, { useState } from 'react';
import { 
  Clock, 
  Calendar, 
  Users, 
  Award, 
  Monitor, 
  MapPin,
  CheckCircle,
  ArrowRight,
  Stethoscope,
  Shield,
  Building,
  User,
  Heart,
  UserCheck,
  Lightbulb,
  Smartphone
} from 'lucide-react';

const Programs = () => {
  const [activeTab, setActiveTab] = useState('training');

  const trainingPrograms = [
    {
      icon: Stethoscope,
      title: 'Healthcare Professionals',
      description: 'Specialized sign language training for doctors, nurses, and healthcare workers to improve patient care and communication.',
      duration: '3 months',
      format: 'In-person & Online'
    },
    {
      icon: Shield,
      title: 'Law Enforcement & Security',
      description: 'Essential sign language skills for police officers, security personnel, and legal professionals.',
      duration: '3 months',
      format: 'In-person & Online'
    },
    {
      icon: Heart,
      title: 'Community Learning Workshops',
      description: 'Open workshops for community members to learn basic sign language and Deaf awareness.',
      duration: 'Ongoing',
      format: 'Community Centers'
    },
    {
      icon: Building,
      title: 'Corporate & Organizational Programs',
      description: 'Customized training programs for businesses and organizations to create inclusive workplaces.',
      duration: 'Flexible',
      format: 'On-site & Virtual'
    },
    {
      icon: User,
      title: 'Individual & Family Courses',
      description: 'Personal sign language courses for individuals and families with Deaf members.',
      duration: '3 months',
      format: 'Flexible'
    }
  ];

  const schedule = [
    {
      type: 'Online Training',
      days: 'Monday & Tuesday',
      time: '4:00 PM – 6:00 PM',
      format: 'Live sessions with recorded videos',
      icon: Monitor
    },
    {
      type: 'Physical Training',
      days: 'Thursday',
      time: '3:40 PM – 5:30 PM',
      format: 'In-person at our center',
      icon: MapPin
    },
    {
      type: 'Weekend Sessions',
      days: 'Saturday',
      time: '9:30 AM – 12:30 PM',
      format: 'In-person intensive',
      icon: Calendar
    }
  ];

  const empowermentPrograms = [
    {
      title: 'Deaf Youth Leadership Development',
      description: 'Comprehensive leadership training program designed to develop the next generation of Deaf leaders.',
      features: ['Leadership Skills', 'Public Speaking', 'Project Management', 'Mentorship']
    },
    {
      title: 'Women\'s Vocational Training',
      description: 'Skills-based training programs to help Deaf women develop entrepreneurship and vocational skills.',
      features: ['Business Skills', 'Technical Training', 'Financial Literacy', 'Networking']
    },
    {
      title: 'Mentorship Program',
      description: 'Pairing young Deaf individuals with experienced mentors for personal and professional guidance.',
      features: ['Career Guidance', 'Personal Development', 'Skill Building', 'Network Building']
    }
  ];

  const technologyPrograms = [
    {
      title: 'Online Learning Platform',
      description: 'Digital platform offering comprehensive USL courses with interactive content and progress tracking.',
      status: 'Available Now'
    },
    {
      title: 'Mobile Learning App',
      description: 'Interactive mobile application for learning sign language on-the-go with gamification features.',
      status: 'Coming Soon'
    },
    {
      title: 'Digital Resource Library',
      description: 'Extensive collection of videos, tutorials, and guides for sign language learning and Deaf culture.',
      status: 'Available Now'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Our Programs</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              Comprehensive programs designed to promote sign language learning, 
              empower the Deaf community, and create inclusive opportunities for all
            </p>
          </div>
        </div>
      </section>

      {/* Program Categories */}
      <section className="py-8 bg-white sticky top-20 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setActiveTab('training')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'training'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sign Language Training
            </button>
            <button
              onClick={() => setActiveTab('empowerment')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'empowerment'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Youth & Women Empowerment
            </button>
            <button
              onClick={() => setActiveTab('advocacy')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'advocacy'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Advocacy & Awareness
            </button>
            <button
              onClick={() => setActiveTab('technology')}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === 'technology'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Technology for Inclusion
            </button>
          </div>
        </div>
      </section>

      {/* Sign Language Training */}
      {activeTab === 'training' && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Sign Language Training Programs</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Master Class Sign Language Initiative offers comprehensive training programs for individuals, 
                organizations, and communities to learn Ugandan Sign Language.
              </p>
            </div>

            {/* Training Programs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
              {trainingPrograms.map((program, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8">
                  <div className="bg-blue-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                    <program.icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{program.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{program.description}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {program.duration}
                    </span>
                    <span className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {program.format}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Training Schedule */}
            <div className="bg-gray-50 rounded-xl p-8 mb-16">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Training Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {schedule.map((item, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center mb-4">
                      <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <item.icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">{item.type}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {item.days}
                      </p>
                      <p className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        {item.time}
                      </p>
                      <p className="text-gray-500">{item.format}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certification */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-8">
              <div className="text-center">
                <div className="bg-orange-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <Award className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Certificate Award</h3>
                <p className="text-gray-600 leading-relaxed max-w-3xl mx-auto">
                  Participants who complete the full three-month training program will receive an 
                  official MCSLI Certificate issued by the Uganda National Association of the Deaf (UNAD) 
                  recognizing their achievement and proficiency in Ugandan Sign Language.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Youth & Women Empowerment */}
      {activeTab === 'empowerment' && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Youth & Women Empowerment</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Developing leadership skills and providing opportunities for Deaf youth and women 
                to thrive in their personal and professional lives.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {empowermentPrograms.map((program, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg p-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{program.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{program.description}</p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Program Features:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {program.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center text-sm text-gray-600">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Advocacy & Awareness */}
      {activeTab === 'advocacy' && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Advocacy & Awareness Programs</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Championing equal rights and creating awareness about Deaf culture and accessibility needs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-blue-900 mb-4">Policy Engagement</h3>
                <p className="text-blue-700 mb-6">Working with government and stakeholders to create inclusive policies.</p>
                <ul className="space-y-2">
                  <li className="flex items-center text-blue-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Government Consultations
                  </li>
                  <li className="flex items-center text-blue-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Policy Development Support
                  </li>
                  <li className="flex items-center text-blue-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Legislative Advocacy
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-green-900 mb-4">Community Campaigns</h3>
                <p className="text-green-700 mb-6">Raising awareness and promoting understanding in communities.</p>
                <ul className="space-y-2">
                  <li className="flex items-center text-green-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Awareness Events
                  </li>
                  <li className="flex items-center text-green-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Educational Workshops
                  </li>
                  <li className="flex items-center text-green-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Cultural Exchange Programs
                  </li>
                </ul>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-orange-900 mb-4">Public Education</h3>
                <p className="text-orange-700 mb-6">Educating the public about Deaf culture and accessibility.</p>
                <ul className="space-y-2">
                  <li className="flex items-center text-orange-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Media Campaigns
                  </li>
                  <li className="flex items-center text-orange-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    School Programs
                  </li>
                  <li className="flex items-center text-orange-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Community Presentations
                  </li>
                </ul>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-xl p-8">
                <h3 className="text-xl font-semibold text-purple-900 mb-4">Storytelling & Testimonials</h3>
                <p className="text-purple-700 mb-6">Sharing powerful stories from our community members.</p>
                <ul className="space-y-2">
                  <li className="flex items-center text-purple-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Success Stories
                  </li>
                  <li className="flex items-center text-purple-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Video Testimonials
                  </li>
                  <li className="flex items-center text-purple-600">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Community Spotlights
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Technology for Inclusion */}
      {activeTab === 'technology' && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Technology for Inclusion</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Leveraging technology to create accessible learning experiences and improve communication 
                opportunities for the Deaf community.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {technologyPrograms.map((program, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg p-8">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">{program.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      program.status === 'Available Now' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {program.status}
                    </span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{program.description}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white text-center">
              <div className="mb-6">
                <Smartphone className="h-16 w-16 mx-auto mb-4 opacity-90" />
                <h3 className="text-2xl font-bold mb-4">Our Mobile App - Coming Soon!</h3>
                <p className="text-blue-100 leading-relaxed max-w-2xl mx-auto">
                  We're developing an innovative mobile application that will revolutionize how people 
                  learn Ugandan Sign Language. With interactive lessons, gamification, and progress tracking, 
                  learning USL will be more engaging and accessible than ever before.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">500+</div>
                  <div className="text-sm text-blue-200">Interactive Lessons</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">50+</div>
                  <div className="text-sm text-blue-200">Practice Exercises</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">24/7</div>
                  <div className="text-sm text-blue-200">Access</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">FREE</div>
                  <div className="text-sm text-blue-200">Basic Version</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Programs;