import React from 'react';
import { 
  GraduationCap, 
  Megaphone, 
  BookOpen, 
  Users2, 
  Smartphone, 
  Heart, 
  Handshake, 
  Search, 
  Radio
} from 'lucide-react';

const FocusAreas = () => {
  const focusAreas = [
    {
      icon: BookOpen,
      title: 'Sign Language Education',
      description: 'Comprehensive training programs in Ugandan Sign Language for individuals, families, and organizations to promote effective communication.',
      features: ['Individual Classes', 'Group Workshops', 'Online Learning', 'Certification Programs']
    },
    {
      icon: Megaphone,
      title: 'Deaf Rights Advocacy',
      description: 'Championing equal rights and opportunities for Deaf and Hard of Hearing individuals through policy engagement and awareness campaigns.',
      features: ['Policy Development', 'Government Engagement', 'Legal Support', 'Rights Education']
    },
    {
      icon: GraduationCap,
      title: 'Inclusive Education',
      description: 'Working to ensure Deaf children have access to quality education through inclusive learning environments and specialized support.',
      features: ['School Programs', 'Teacher Training', 'Educational Resources', 'Student Support']
    },
    {
      icon: Users2,
      title: 'Youth & Women Empowerment',
      description: 'Developing leadership skills and providing vocational training to empower Deaf youth and women in their personal and professional growth.',
      features: ['Leadership Programs', 'Vocational Training', 'Mentorship', 'Entrepreneurship']
    },
    {
      icon: Smartphone,
      title: 'Technology for Inclusion',
      description: 'Developing and implementing technological solutions to improve accessibility and communication for the Deaf community.',
      features: ['Mobile Apps', 'Online Platforms', 'Assistive Technology', 'Digital Resources']
    },
    {
      icon: Heart,
      title: 'Community Awareness & Outreach',
      description: 'Building understanding and acceptance within communities about Deaf culture, communication, and accessibility needs.',
      features: ['Community Events', 'Awareness Campaigns', 'Cultural Programs', 'Public Education']
    },
    {
      icon: Handshake,
      title: 'Partnerships & Collaboration',
      description: 'Building strategic partnerships with organizations, institutions, and stakeholders to amplify our impact and reach.',
      features: ['Strategic Alliances', 'Institutional Partnerships', 'Community Networks', 'Collaborative Projects']
    },
    {
      icon: Search,
      title: 'Research & Development',
      description: 'Conducting research to better understand the needs of the Deaf community and develop evidence-based solutions and programs.',
      features: ['Community Research', 'Program Evaluation', 'Best Practices', 'Innovation Development']
    },
    {
      icon: Radio,
      title: 'Public Engagement & Media',
      description: 'Engaging with media and the public to raise awareness about Deaf issues and promote positive representation of the Deaf community.',
      features: ['Media Relations', 'Content Creation', 'Public Speaking', 'Social Media Campaigns']
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Our Focus Areas</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              We work across multiple interconnected areas to create comprehensive support 
              and opportunities for the Deaf community in Uganda
            </p>
          </div>
        </div>
      </section>

      {/* Focus Areas Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {focusAreas.map((area, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className="p-8">
                  <div className="bg-blue-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                    <area.icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{area.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{area.description}</p>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Key Areas:</h4>
                    <ul className="space-y-1">
                      {area.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2 flex-shrink-0"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Statement */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-8">Creating Comprehensive Impact</h2>
            <div className="max-w-4xl mx-auto">
              <p className="text-xl text-gray-600 leading-relaxed mb-8">
                Our multifaceted approach ensures that we address the diverse needs of the Deaf community 
                while working to create systemic change that benefits everyone. Through these interconnected 
                focus areas, we're building a more inclusive Uganda where communication barriers are eliminated.
              </p>
              <div className="bg-white p-8 rounded-xl shadow-md">
                <h3 className="text-2xl font-semibold text-blue-600 mb-4">Our Integrated Approach</h3>
                <p className="text-gray-600 leading-relaxed">
                  Each focus area works in harmony with the others. Education supports advocacy efforts, 
                  technology enhances learning opportunities, community outreach builds awareness that 
                  enables policy change, and research informs all our programs. This comprehensive strategy 
                  ensures sustainable, long-term impact for the Deaf community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FocusAreas;