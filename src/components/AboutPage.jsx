import { Users, Heart, Shield, Star, Award, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import modernSpace from '../assets/modern_coliving_space.jpg';
import sharedKitchen from '../assets/shared_kitchen.jpg';
import singaporeApartment from '../assets/singapore_apartment_living.jpg';

const AboutPage = () => {
  const values = [
    {
      icon: Users,
      title: 'Community First',
      description: 'We believe that great living experiences come from meaningful connections with like-minded individuals.'
    },
    {
      icon: Heart,
      title: 'Comfort & Care',
      description: 'Every detail is designed with your comfort in mind, from premium furnishings to responsive support.'
    },
    {
      icon: Shield,
      title: 'Trust & Safety',
      description: 'Your safety and security are our top priorities, with 24/7 support and verified community members.'
    },
    {
      icon: Globe,
      title: 'Global Community',
      description: 'Connect with residents from around the world and build lasting international friendships.'
    }
  ];

  const stats = [
    { number: '500+', label: 'Happy Residents' },
    { number: '25+', label: 'Premium Properties' },
    { number: '15+', label: 'Nationalities' }
  ];

  const team = [
    {
      name: 'Mark Wee',
      role: 'Co-Founder',
      bio: 'Visionary leader driving Hyve\'s growth and strategic direction in Singapore\'s coliving market.',
      initials: 'MW',
      photo: '/mark.jpeg'
    },
    {
      name: 'Matthew Mbarek',
      role: 'Co-Founder',
      bio: 'Innovation-focused co-founder dedicated to creating exceptional resident experiences.',
      initials: 'MM',
      photo: '/matt.jpeg'
    },
    {
      name: 'Haron Hussman',
      role: 'Operations Executive',
      bio: 'Operations expert ensuring seamless day-to-day management and resident satisfaction.',
      initials: 'HH'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Hero Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6">
                Redefining Coliving in Singapore
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                At Hyve, we're more than just a coliving provider. We're community builders, 
                creating spaces where young professionals and students can thrive, connect, 
                and call home in one of the world's most vibrant cities.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img
                src="/stock_apart1.png"
                alt="Modern coliving space"
                className="rounded-lg shadow-lg"
              />
              <img
                src="/stock_apart2.png"
                alt="Shared kitchen"
                className="rounded-lg shadow-lg mt-8"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold mb-2">{stat.number}</div>
                <div className="text-teal-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="text-xl text-gray-600">
              How we started and where we're going
            </p>
          </div>
          
          <div className="prose prose-lg mx-auto text-gray-600">
            <p>
              Founded in 2020, Hyve was born from a simple observation: young professionals 
              and students in Singapore were struggling to find quality, affordable housing 
              that also provided a sense of community and belonging.
            </p>
            
            <p>
              Our founders, having experienced the challenges of relocating to a new city 
              firsthand, set out to create something different. Not just a place to sleep, 
              but a home where residents could build meaningful relationships, advance their 
              careers, and truly enjoy their time in Singapore.
            </p>
            
            <p>
              Today, we're proud to house over 500 residents across 25+ premium properties 
              in Singapore's most desirable neighborhoods. Our community spans 15+ nationalities, 
              creating a truly global living experience right in the heart of Southeast Asia.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-teal-600" />
                    </div>
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600">
                      {value.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Meet Our Team</h2>
            <p className="text-xl text-gray-600">
              The people behind your exceptional coliving experience
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-teal-600">{member.initials}</span>
                    )}
                  </div>
                  <CardTitle className="text-xl">{member.name}</CardTitle>
                  <Badge variant="secondary" className="mx-auto">{member.role}</Badge>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {member.bio}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-teal-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Our Mission</h2>
          <p className="text-2xl text-gray-700 mb-8 font-light">
            "To create exceptional coliving experiences that foster community, 
            personal growth, and lasting connections in Singapore's most vibrant neighborhoods."
          </p>
          <div className="relative">
            <img
              src="/stock_apart1.png"
              alt="Singapore apartment living"
              className="rounded-2xl shadow-xl mx-auto"
            />
          </div>
        </div>
      </section>

      {/* Awards & Recognition */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Awards & Recognition</h2>
            <p className="text-xl text-gray-600">
              Recognized for excellence in coliving and community building
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <Award className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <CardTitle>Best Coliving Provider 2024</CardTitle>
                <CardDescription>Singapore Property Awards</CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="text-center">
              <CardHeader>
                <Users className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <CardTitle>Innovation in Housing</CardTitle>
                <CardDescription>Urban Living Excellence</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

    </div>
  );
};

export default AboutPage;

