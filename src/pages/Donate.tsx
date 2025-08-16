import React from 'react';
import { 
  Heart, 
  Smartphone, 
  Building2, 
  Gift, 
  Users, 
  GraduationCap,
  CheckCircle,
  ArrowRight,
  MapPin,
  Globe
} from 'lucide-react';

const Donate = () => {
  const donationMethods = [
    {
      icon: Smartphone,
      title: 'Mobile Money',
      description: 'Send donations via MTN or Airtel mobile money',
      details: ['MTN Mobile Money', 'Airtel Money', 'Quick and secure', 'Available 24/7'],
      color: 'bg-green-500'
    },
    {
      icon: Building2,
      title: 'Bank Transfer',
      description: 'Direct bank transfer to our official account',
      details: ['Secure bank transfer', 'Receipt provided', 'Tax deductible', 'International transfers accepted'],
      color: 'bg-blue-500'
    },
    {
      icon: Gift,
      title: 'In-kind Donations',
      description: 'Donate materials, equipment, or services',
      details: ['Training materials', 'Technology equipment', 'Professional services', 'Educational resources'],
      color: 'bg-purple-500'
    },
    {
      icon: GraduationCap,
      title: 'Sponsor a Student',
      description: 'Sponsor a student\'s complete training program',
      details: ['3-month program sponsorship', 'Certificate included', 'Progress updates', 'Direct impact'],
      color: 'bg-orange-500'
    }
  ];

  const impactAreas = [
    {
      title: 'Training Programs',
      description: 'Fund sign language training for individuals and organizations',
      impact: 'Reach 100+ people per district'
    },
    {
      title: 'Educational Materials',
      description: 'Develop and distribute learning resources and materials',
      impact: 'Create lasting educational impact'
    },
    {
      title: 'Community Outreach',
      description: 'Expand our awareness campaigns to more communities',
      impact: 'Change attitudes and build understanding'
    },
    {
      title: 'Technology Development',
      description: 'Build accessible learning platforms and mobile apps',
      impact: 'Scale our reach across Uganda'
    },
    {
      title: 'Youth Empowerment',
      description: 'Support leadership and vocational training programs',
      impact: 'Empower the next generation'
    },
    {
      title: 'Advocacy Efforts',
      description: 'Fund policy engagement and rights advocacy activities',
      impact: 'Create systemic change'
    }
  ];

  const donationImpact = [
    { amount: '50,000 UGX', impact: 'Provides basic training materials for 5 students' },
    { amount: '100,000 UGX', impact: 'Sponsors one student\'s complete 3-month program' },
    { amount: '250,000 UGX', impact: 'Funds community awareness workshop in one district' },
    { amount: '500,000 UGX', impact: 'Supports trainer\'s salary for one month' },
    { amount: '1,000,000 UGX', impact: 'Establishes training center in a new district' },
    { amount: 'Any Amount', impact: 'Every contribution makes a difference!' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-orange-600 to-red-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Support Our Mission</h1>
            <p className="text-xl text-orange-100 max-w-3xl mx-auto leading-relaxed mb-8">
              Your support helps MCSLI reach all districts in Uganda, providing awareness, training, 
              and learning opportunities about sign language and the Deaf community to make 
              communication easier and more inclusive.
            </p>
            <div className="flex items-center justify-center space-x-2 text-orange-200">
              <MapPin className="h-5 w-5" />
              <span>Reaching all districts in Uganda</span>
              <Globe className="h-5 w-5 ml-4" />
              <span>Creating lasting impact</span>
            </div>
          </div>
        </div>
      </section>

      {/* Donation Impact Stats */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white text-4xl font-bold rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">15+</div>
              <h3 className="text-lg font-semibold text-gray-900">Districts Reached</h3>
              <p className="text-gray-600">And growing with your support</p>
            </div>
            <div className="text-center">
              <div className="bg-green-600 text-white text-4xl font-bold rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">500+</div>
              <h3 className="text-lg font-semibold text-gray-900">People Trained</h3>
              <p className="text-gray-600">Lives changed through education</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-600 text-white text-4xl font-bold rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">8</div>
              <h3 className="text-lg font-semibold text-gray-900">Active Programs</h3>
              <p className="text-gray-600">Comprehensive support services</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ways to Give */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Ways to Give</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the donation method that works best for you. Every contribution, 
              regardless of size, makes a meaningful difference.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {donationMethods.map((method, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8">
                <div className={`${method.color} w-16 h-16 rounded-lg flex items-center justify-center mb-6`}>
                  <method.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{method.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{method.description}</p>
                <ul className="space-y-2">
                  {method.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-center text-sm text-gray-500">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donation Impact */}
      <section className="bg-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Your Donation Impact</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how your contribution directly translates into positive change for the Deaf community
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {donationImpact.map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">{item.amount}</div>
                  <p className="text-gray-600 leading-relaxed">{item.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where Your Money Goes */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Where Your Money Goes</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We ensure every donation is used effectively to maximize impact across our focus areas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {impactAreas.map((area, index) => (
              <div key={index} className="bg-gray-50 p-8 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{area.title}</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">{area.description}</p>
                <div className="flex items-center text-blue-600 font-medium">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {area.impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-green-600 to-blue-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Make a Difference?
            </h2>
            <p className="text-xl text-green-100 mb-8 leading-relaxed">
              Join us in creating a more inclusive Uganda where communication barriers no longer exist. 
              Your support empowers the Deaf community and creates lasting change.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-green-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center space-x-2">
                <Heart className="h-5 w-5" />
                <span>Donate Now</span>
              </button>
              <button className="border-2 border-white text-white hover:bg-white hover:text-green-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105">
                Learn More About Our Impact
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact for Donations */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Need Help with Your Donation?</h3>
          <p className="text-gray-600 mb-8">
            Our team is here to assist you with any questions about donating or to help you set up regular contributions.
          </p>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Smartphone className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-gray-900 font-medium">0701806993</p>
                <p className="text-gray-500 text-sm">WhatsApp & SMS</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Heart className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-gray-900 font-medium">mclass394@gmail.com</p>
                <p className="text-gray-500 text-sm">Email us directly</p>
              </div>
              <div className="text-center">
                <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="h-6 w-6 text-orange-600" />
                </div>
                <p className="text-gray-900 font-medium">Visit Our Office</p>
                <p className="text-gray-500 text-sm">Plot 254, Makerere</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Donate;