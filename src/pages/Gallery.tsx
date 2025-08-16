import React, { useState } from 'react';
import { 
  Play, 
  Image as ImageIcon,
  Users,
  GraduationCap,
  Heart,
  Megaphone,
  Lightbulb,
  Star,
  Eye
} from 'lucide-react';

const Gallery = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Photos', icon: ImageIcon },
    { id: 'training', name: 'Training Sessions', icon: GraduationCap },
    { id: 'community', name: 'Community Events', icon: Users },
    { id: 'empowerment', name: 'Youth & Women Empowerment', icon: Heart },
    { id: 'advocacy', name: 'Advocacy Campaigns', icon: Megaphone },
    { id: 'technology', name: 'Technology & Innovation', icon: Lightbulb }
  ];

  const galleryItems = [
    {
      id: 1,
      category: 'training',
      title: 'Sign Language Training Session',
      description: 'Healthcare professionals learning USL to better serve Deaf patients',
      image: 'https://images.pexels.com/photos/3184433/pexels-photo-3184433.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'November 2024',
      type: 'photo'
    },
    {
      id: 2,
      category: 'community',
      title: 'Community Awareness Event',
      description: 'Engaging with local communities about Deaf culture and inclusion',
      image: 'https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'October 2024',
      type: 'photo'
    },
    {
      id: 3,
      category: 'empowerment',
      title: 'Women Leadership Workshop',
      description: 'Empowering Deaf women with entrepreneurship and leadership skills',
      image: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'September 2024',
      type: 'photo'
    },
    {
      id: 4,
      category: 'training',
      title: 'Corporate Training Program',
      description: 'Teaching sign language to corporate teams for workplace inclusion',
      image: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'August 2024',
      type: 'video'
    },
    {
      id: 5,
      category: 'advocacy',
      title: 'Policy Engagement Meeting',
      description: 'Working with government officials on inclusive policy development',
      image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'July 2024',
      type: 'photo'
    },
    {
      id: 6,
      category: 'community',
      title: 'International Week of Deaf People',
      description: 'Celebrating Deaf culture and achievements in our community',
      image: 'https://images.pexels.com/photos/3184287/pexels-photo-3184287.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'September 2024',
      type: 'photo'
    },
    {
      id: 7,
      category: 'empowerment',
      title: 'Youth Leadership Camp',
      description: 'Young Deaf leaders developing skills for community impact',
      image: 'https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'June 2024',
      type: 'photo'
    },
    {
      id: 8,
      category: 'technology',
      title: 'Mobile App Development',
      description: 'Working on our innovative sign language learning application',
      image: 'https://images.pexels.com/photos/3184357/pexels-photo-3184357.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'May 2024',
      type: 'photo'
    },
    {
      id: 9,
      category: 'advocacy',
      title: 'Media Interview Session',
      description: 'Sharing our mission and impact with local media outlets',
      image: 'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'April 2024',
      type: 'video'
    },
    {
      id: 10,
      category: 'training',
      title: 'Family Sign Language Class',
      description: 'Teaching families how to communicate with their Deaf members',
      image: 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'March 2024',
      type: 'photo'
    },
    {
      id: 11,
      category: 'community',
      title: 'School Outreach Program',
      description: 'Educating students about Deaf awareness and inclusion',
      image: 'https://images.pexels.com/photos/3184295/pexels-photo-3184295.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'February 2024',
      type: 'photo'
    },
    {
      id: 12,
      category: 'technology',
      title: 'Online Learning Platform',
      description: 'Developing digital resources for remote sign language learning',
      image: 'https://images.pexels.com/photos/3184431/pexels-photo-3184431.jpeg?auto=compress&cs=tinysrgb&w=600',
      date: 'January 2024',
      type: 'photo'
    }
  ];

  const filteredItems = activeCategory === 'all' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === activeCategory);

  const stats = [
    { number: '100+', label: 'Photos & Videos' },
    { number: '50+', label: 'Events Documented' },
    { number: '15', label: 'Districts Covered' },
    { number: '2+', label: 'Years of Stories' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Our Gallery</h1>
            <p className="text-xl text-purple-100 max-w-3xl mx-auto leading-relaxed">
              Explore the visual story of our journey - from training sessions and community events 
              to advocacy campaigns and impact stories that showcase our commitment to empowering the Deaf community
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-purple-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-lg font-semibold text-gray-700">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 bg-white sticky top-20 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeCategory === category.id
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <category.icon className="h-4 w-4" />
                <span className="text-sm">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                <div className="relative aspect-square overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {item.type === 'video' ? (
                        <div className="bg-purple-600 rounded-full p-3">
                          <Play className="h-8 w-8 text-white fill-current" />
                        </div>
                      ) : (
                        <div className="bg-white bg-opacity-90 rounded-full p-3">
                          <Eye className="h-8 w-8 text-purple-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.type === 'video' 
                        ? 'bg-red-500 text-white' 
                        : 'bg-blue-500 text-white'
                    }`}>
                      {item.type === 'video' ? 'Video' : 'Photo'}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.date}</span>
                    <span className={`w-3 h-3 rounded-full ${
                      item.category === 'training' ? 'bg-blue-500' :
                      item.category === 'community' ? 'bg-green-500' :
                      item.category === 'empowerment' ? 'bg-pink-500' :
                      item.category === 'advocacy' ? 'bg-orange-500' :
                      'bg-purple-500'
                    }`}></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-16">
              <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No images found in this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* Impact Stories Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Impact Stories</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every photo tells a story of transformation, empowerment, and positive change in our community
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Educational Impact</h3>
              <p className="text-gray-600 leading-relaxed">
                Our training sessions have equipped hundreds with sign language skills, 
                creating bridges between Deaf and hearing communities.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Community Building</h3>
              <p className="text-gray-600 leading-relaxed">
                Through our events, we've fostered understanding and built inclusive 
                communities that celebrate diversity and embrace everyone.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Personal Growth</h3>
              <p className="text-gray-600 leading-relaxed">
                Our empowerment programs have helped individuals develop confidence, 
                leadership skills, and pursue their dreams without limitations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">
              Be Part of Our Story
            </h2>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Join us at our next event and become part of the positive change we're creating. 
              Your participation helps us document more stories of impact and transformation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg">
                Join Our Next Event
              </button>
              <button className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105">
                Share Your Story
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Gallery;