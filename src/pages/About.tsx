import React from 'react';
import { CheckCircle, Target, Eye, Quote } from 'lucide-react';

const About = () => {
  const coreValues = [
    'Inclusivity', 'Innovation', 'Teamwork', 'Equality', 'Integrity',
    'Accessibility', 'Connection', 'Empowerment', 'Creativity', 'Impact'
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">About MCSLI</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              Empowering the Deaf community through sign language, education, and advocacy since 2023
            </p>
          </div>
        </div>
      </section>

      {/* Who We Are */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Who We Are</h2>
              <div className="space-y-6">
                <p className="text-lg text-gray-600 leading-relaxed">
                  MCSLI is a non-profit organization founded in 2023 and officially registered with the 
                  Uganda Registration Services Bureau (URSB) in 2024 – Registration Number: 80034987295030.
                </p>
                <p className="text-lg text-gray-600 leading-relaxed">
                  We are committed to providing equal opportunities for Deaf and Hard of Hearing individuals 
                  in Uganda. We believe communication is a human right, and through sign language, we bridge 
                  the gap between Deaf and hearing communities.
                </p>
                <div className="bg-orange-50 p-6 rounded-lg border-l-4 border-orange-500">
                  <div className="flex items-start space-x-3">
                    <Quote className="h-6 w-6 text-orange-500 mt-1 flex-shrink-0" />
                    <p className="text-lg font-medium text-orange-700">
                      "Through Sign Language, the Hand Can Speak"
                    </p>
                  </div>
                  <p className="text-orange-600 mt-2 font-medium">Our Slogan</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">Organization Details</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">Founded: 2023</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">Officially Registered: 2024</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">Registration #: 80034987295030</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">Type: Non-profit Organization</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">Leadership: Deaf-led</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Mission */}
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Target className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Our Mission</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed">
                To promote Ugandan Sign Language (USL) and empower the Deaf community through 
                education, advocacy, and inclusive opportunities.
              </p>
            </div>

            {/* Vision */}
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <Eye className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Our Vision</h3>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed">
                A society where Deaf and Hard of Hearing individuals enjoy equal access, 
                full participation, and opportunity in all aspects of life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Founder's Vision */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-8">Founder's Vision 2040</h2>
            <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-8">
              <p className="text-xl text-blue-100 leading-relaxed">
                "By 2040, MCSLI aims to eliminate communication barriers in Uganda and East Africa, 
                ensuring that Deaf and Hard of Hearing individuals can fully participate in all sectors 
                of society without limitations."
              </p>
              <div className="mt-6">
                <p className="text-orange-300 font-semibold">- Ssenyonjo Jim Maurice, Founder & Executive Director</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Core Values</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              These values guide our work and define who we are as an organization
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {coreValues.map((value, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 text-center border-t-4 border-blue-500">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{value}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Info */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Official Registration</h3>
            <p className="text-gray-600 mb-4">
              MCSLI is officially registered with the Uganda Registration Services Bureau (URSB)
            </p>
            <div className="text-3xl font-bold text-blue-600">80034987295030</div>
            <p className="text-sm text-gray-500 mt-2">Registration Number</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;