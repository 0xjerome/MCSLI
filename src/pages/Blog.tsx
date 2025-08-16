import React from 'react';
import { 
  Calendar, 
  User, 
  Clock, 
  ArrowRight,
  BookOpen,
  MessageCircle,
  Heart,
  Users,
  Lightbulb,
  Star
} from 'lucide-react';

const Blog = () => {
  const featuredPost = {
    id: 1,
    title: 'Why Sign Language Matters in Uganda: Breaking Down Communication Barriers',
    excerpt: 'Uganda is home to a vibrant Deaf community, yet communication barriers continue to limit opportunities and inclusion. Discover why learning Ugandan Sign Language is crucial for building an inclusive society.',
    content: 'In Uganda, effective communication is the key to unlocking opportunities, building relationships, and fostering understanding. For the Deaf community, sign language is not just a mode of communication—it is a bridge to equal participation in society...',
    author: 'Ssenyonjo Jim Maurice',
    date: '2024-12-15',
    readTime: '8 min read',
    category: 'Education',
    image: 'https://images.pexels.com/photos/3184433/pexels-photo-3184433.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true
  };

  const blogPosts = [
    {
      id: 2,
      title: '5 Ways to Communicate Better with the Deaf Community',
      excerpt: 'Simple yet effective strategies for hearing individuals to improve communication and build meaningful relationships with Deaf people.',
      author: 'Nakato Lilian',
      date: '2024-12-10',
      readTime: '5 min read',
      category: 'Communication',
      image: 'https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg?auto=compress&cs=tinysrgb&w=600',
    },
    {
      id: 3,
      title: 'Highlights from Our Deaf Awareness Campaign in Jinja',
      excerpt: 'A look back at our successful community awareness campaign that reached over 200 people and changed perspectives about Deaf culture.',
      author: 'Iraguha Emmanuel',
      date: '2024-12-05',
      readTime: '6 min read',
      category: 'Events',
      image: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=600',
    },
    {
      id: 4,
      title: 'Volunteer Spotlight: Meet Sarah Johnson from Canada',
      excerpt: 'International volunteer Sarah shares her experience working with MCSLI and how it has transformed her understanding of Deaf culture.',
      author: 'Bukenya Eric Paul',
      date: '2024-11-28',
      readTime: '4 min read',
      category: 'Volunteer Stories',
      image: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600',
    },
    {
      id: 5,
      title: 'Innovations in Sign Language Training: Our New Online Platform',
      excerpt: 'Discover how technology is revolutionizing sign language education and making learning more accessible than ever before.',
      author: 'Ochen Morris',
      date: '2024-11-20',
      readTime: '7 min read',
      category: 'Technology',
      image: 'https://images.pexels.com/photos/3184431/pexels-photo-3184431.jpeg?auto=compress&cs=tinysrgb&w=600',
    },
    {
      id: 6,
      title: 'Building Inclusive Workplaces: A Guide for Employers',
      excerpt: 'Practical steps organizations can take to create inclusive work environments for Deaf and Hard of Hearing employees.',
      author: 'Kakooza Peter',
      date: '2024-11-15',
      readTime: '9 min read',
      category: 'Workplace Inclusion',
      image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=600',
    },
    {
      id: 7,
      title: 'The Power of Youth Leadership in the Deaf Community',
      excerpt: 'How young Deaf leaders are driving change and inspiring their peers to pursue their dreams without limitations.',
      author: 'Mulindwa Max',
      date: '2024-11-10',
      readTime: '6 min read',
      category: 'Youth Empowerment',
      image: 'https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=600',
    }
  ];

  const categories = [
    'All Posts',
    'Education',
    'Communication',
    'Events',
    'Volunteer Stories',
    'Technology',
    'Workplace Inclusion',
    'Youth Empowerment'
  ];

  const stats = [
    { icon: BookOpen, number: '50+', label: 'Articles Published' },
    { icon: Users, number: '1,000+', label: 'Monthly Readers' },
    { icon: MessageCircle, number: '200+', label: 'Community Comments' },
    { icon: Heart, number: '95%', label: 'Positive Feedback' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">MCSLI Blog & News</h1>
            <p className="text-xl text-indigo-100 max-w-3xl mx-auto leading-relaxed">
              Stay updated with the latest stories, insights, and news from our work in empowering 
              the Deaf community and promoting inclusive communication across Uganda
            </p>
          </div>
        </div>
      </section>

      {/* Blog Stats */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <stat.icon className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Article</h2>
            <p className="text-xl text-gray-600">Our most impactful story this month</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <div className="aspect-video lg:aspect-square overflow-hidden">
                <img 
                  src={featuredPost.image} 
                  alt={featuredPost.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8 lg:p-12 flex flex-col justify-center">
                <div className="flex items-center space-x-4 mb-4">
                  <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                    {featuredPost.category}
                  </span>
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                    Featured
                  </span>
                </div>
                
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4 leading-tight">
                  {featuredPost.title}
                </h3>
                
                <p className="text-gray-600 mb-6 leading-relaxed text-lg">
                  {featuredPost.excerpt}
                </p>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      {featuredPost.author}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(featuredPost.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {featuredPost.readTime}
                    </div>
                  </div>
                </div>
                
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg flex items-center space-x-2 w-fit">
                  <span>Read Full Article</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Latest Articles</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Explore our collection of stories, insights, and updates from the field
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article key={post.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <div className="mb-3">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {post.category}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2 leading-tight">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {post.author}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {post.readTime}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {new Date(post.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                    <button className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center space-x-1 transition-colors duration-200">
                      <span>Read More</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-6">Stay Connected</h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Subscribe to our newsletter to receive the latest updates, stories, and insights 
              directly in your inbox. Join our growing community of advocates and supporters.
            </p>
            
            <div className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="email" 
                  placeholder="Enter your email address"
                  className="flex-1 px-6 py-4 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-4 focus:ring-blue-300 focus:outline-none"
                />
                <button className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg">
                  Subscribe
                </button>
              </div>
              <p className="text-blue-200 text-sm mt-4">
                No spam, unsubscribe at any time. We respect your privacy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Explore by Category</h3>
            <p className="text-gray-600">Find articles that interest you most</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category, index) => (
              <button 
                key={index}
                className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-full border border-gray-200 font-medium transition-all duration-200 hover:shadow-md"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;