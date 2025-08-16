import React from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Star,
  Megaphone,
  GraduationCap,
  Heart,
  Globe,
  Monitor,
  ArrowRight
} from 'lucide-react';

const Events = () => {
  const upcomingEvents = [
    {
      title: 'International Week of Deaf People',
      date: 'September 2025',
      time: 'All Week',
      location: 'Multiple Locations',
      type: 'Annual Celebration',
      description: 'Join us for a week-long celebration of Deaf culture, achievements, and community. Features workshops, cultural performances, and awareness activities.',
      icon: Globe,
      color: 'bg-blue-500',
      status: 'upcoming'
    },
    {
      title: 'Deaf Youth Leadership Camp',
      date: 'December 2025',
      time: '3 Days',
      location: 'Kampala, Uganda',
      type: 'Leadership Development',
      description: 'Intensive leadership development program for young Deaf individuals. Includes skill-building workshops, networking, and mentorship opportunities.',
      icon: GraduationCap,
      color: 'bg-green-500',
      status: 'upcoming'
    }
  ];

  const ongoingEvents = [
    {
      title: 'Sign Language Awareness Day',
      frequency: 'Monthly',
      location: 'Various Communities',
      description: 'Regular community awareness sessions to promote understanding of Deaf culture and sign language.',
      icon: Heart,
      color: 'bg-orange-500'
    },
    {
      title: 'Community Outreach Programs',
      frequency: 'Monthly',
      location: 'Different Districts',
      description: 'Regular visits to communities across Uganda to provide sign language training and awareness.',
      icon: Users,
      color: 'bg-purple-500'
    },
    {
      title: 'Online Learning Events',
      frequency: 'Weekly',
      location: 'Virtual Platform',
      description: 'Weekly webinars, online workshops, and virtual learning sessions for remote participants.',
      icon: Monitor,
      color: 'bg-blue-500'
    }
  ];

  const eventGallery = [
    {
      title: 'Community Workshop in Jinja',
      date: 'November 2024',
      participants: '45 people',
      description: 'Successful sign language workshop with healthcare workers and community leaders.',
      image: 'https://images.pexels.com/photos/3184433/pexels-photo-3184433.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      title: 'Youth Leadership Training',
      date: 'October 2024',
      participants: '25 youth',
      description: 'Empowering young Deaf individuals with leadership and entrepreneurship skills.',
      image: 'https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      title: 'Deaf Awareness Campaign',
      date: 'September 2024',
      participants: '200+ people',
      description: 'Community awareness event promoting understanding and inclusion.',
      image: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=800'
    }
  ];

  const eventImpact = [
    { metric: '50+', label: 'Events Organized', description: 'Since our founding in 2023' },
    { metric: '1,500+', label: 'Total Participants', description: 'Across all our events' },
    { metric: '15', label: 'Districts Reached', description: 'Throughout Uganda' },
    { metric: '12', label: 'Partner Organizations', description: 'Collaborative events' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Our Events</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              Join us at our events where we celebrate Deaf culture, provide learning opportunities, 
              and build stronger, more inclusive communities across Uganda
            </p>
          </div>
        </div>
      </section>

      {/* Event Impact */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {eventImpact.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-blue-600 mb-2">
                  {stat.metric}
                </div>
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {stat.label}
                </div>
                <div className="text-gray-600 text-sm">
                  {stat.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Upcoming Events</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Mark your calendar for these exciting upcoming events that celebrate and empower our community
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`${event.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                      <event.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {event.type}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{event.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{event.description}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-500">
                      <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center text-gray-500">
                      <Clock className="h-5 w-5 mr-3 text-blue-500" />
                      <span>{event.time}</span>
                    </div>
                    <div className="flex items-center text-gray-500">
                      <MapPin className="h-5 w-5 mr-3 text-blue-500" />
                      <span>{event.location}</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2">
                      <span>Register Interest</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ongoing Events */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Ongoing Programs</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Regular events and programs that are always available for community participation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ongoingEvents.map((event, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                <div className={`${event.color} w-16 h-16 rounded-lg flex items-center justify-center mb-6`}>
                  <event.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{event.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{event.description}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center text-gray-500">
                    <Clock className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-sm">{event.frequency}</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="text-sm">{event.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Event Gallery */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Recent Event Highlights</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Take a look at some of our recent successful events and the positive impact they've made
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventGallery.map((event, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={event.image} 
                    alt={event.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.title}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {event.date}
                    </span>
                    <span className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {event.participants}
                    </span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-gradient-to-r from-orange-600 to-pink-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">
              Join Our Next Event
            </h2>
            <p className="text-xl text-orange-100 mb-8 leading-relaxed">
              Be part of our community events and help us create a more inclusive Uganda. 
              Whether you're learning sign language or supporting our cause, every participation counts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg">
                View All Events
              </button>
              <button className="border-2 border-white text-white hover:bg-white hover:text-orange-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105">
                Get Event Updates
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Events;