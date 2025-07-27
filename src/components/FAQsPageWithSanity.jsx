import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { client, QUERIES } from '../lib/sanity';

const FAQsPage = () => {
  const [openSections, setOpenSections] = useState({});
  const [faqContent, setFaqContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFAQContent = async () => {
      try {
        const sanityFAQs = await client.fetch(QUERIES.faqPage);
        setFaqContent(sanityFAQs);
      } catch (error) {
        console.error('Error fetching FAQ content from Sanity:', error);
        // Will use fallback content below
      } finally {
        setLoading(false);
      }
    };

    fetchFAQContent();
  }, []);

  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Default/fallback FAQ content
  const defaultFaqSections = [
    {
      id: 'getting-started',
      sectionTitle: 'Getting Started',
      questions: [
        {
          question: 'What exactly is coliving?',
          answer: [{ _type: 'block', children: [{ text: 'Coliving is a modern approach to shared living where you get your own private room in a fully furnished apartment, while sharing common areas like the kitchen, living room, and sometimes bathrooms with other residents. It\'s designed to foster genuine community connections while maintaining your personal space and privacy.' }]}]
        },
        {
          question: 'Who is coliving suitable for?',
          answer: [{ _type: 'block', children: [{ text: 'Our coliving spaces are perfect for young professionals, digital nomads, students, expatriates, and anyone looking for an affordable, flexible living arrangement in the city.' }]}]
        },
        {
          question: 'How is coliving different from traditional roommate situations?',
          answer: [{ _type: 'block', children: [{ text: 'Unlike typical roommate arrangements, coliving comes with professional management, regular cleaning services, all utilities included, and carefully curated community members.' }]}]
        }
      ]
    },
    {
      id: 'booking-rental',
      sectionTitle: 'Booking & Rental Terms',
      questions: [
        {
          question: 'What\'s the minimum rental period?',
          answer: [{ _type: 'block', children: [{ text: 'We offer flexible lease terms starting from 3 months, perfect for short-term stays, internships, or project-based work.' }]}]
        },
        {
          question: 'What\'s included in the rent?',
          answer: [{ _type: 'block', children: [{ text: 'Your rent covers everything: fully furnished private room, access to all common areas, high-speed Wi-Fi, utilities, weekly housekeeping, and 24/7 community management.' }]}]
        },
        {
          question: 'Do I need to pay a security deposit?',
          answer: [{ _type: 'block', children: [{ text: 'Yes, we require a refundable security deposit equivalent to one month\'s rent. This covers any potential damages and is returned within 14 days of move-out.' }]}]
        }
      ]
    }
  ];

  // Use Sanity content or fallback
  const heroContent = faqContent?.hero || {
    title: 'Frequently Asked Questions',
    subtitle: 'Find answers to common questions about our coliving spaces, booking process, and community guidelines.'
  };

  const faqSections = faqContent?.faqSections || defaultFaqSections;

  const ctaContent = faqContent?.cta || {
    title: 'Still have questions?',
    description: 'Can\'t find the answer you\'re looking for? Our team is here to help.',
    primaryButton: { text: 'Contact Us', link: '/contact' },
    secondaryButton: { text: 'Schedule a Tour', link: '/tour' }
  };

  const contactInfo = faqContent?.contactInfo || {
    email: 'hello@hyve.sg',
    whatsapp: '+65 80885410'
  };

  // Helper function to render Sanity rich text content
  const renderAnswer = (answer) => {
    if (typeof answer === 'string') {
      return answer; // Fallback content
    }
    
    if (Array.isArray(answer)) {
      return answer.map((block, index) => {
        if (block._type === 'block') {
          return (
            <div key={index} className="mb-2">
              {block.children?.map((child, childIndex) => (
                <span key={childIndex}>{child.text}</span>
              ))}
            </div>
          );
        }
        return null;
      });
    }
    
    return 'No answer provided';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-8"></div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg p-6 mb-4">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link 
            to="/" 
            className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {heroContent.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            {heroContent.subtitle}
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-8">
          {faqSections.map((section, sectionIndex) => (
            <Card key={section.id || sectionIndex} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection(section.id || sectionIndex)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl text-gray-900">
                    {section.sectionTitle || section.title}
                  </CardTitle>
                  {openSections[section.id || sectionIndex] ? (
                    <ChevronDown className="w-6 h-6 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-6 h-6 text-gray-500" />
                  )}
                </div>
              </CardHeader>

              {openSections[section.id || sectionIndex] && (
                <CardContent className="border-t border-gray-100">
                  <div className="space-y-6 pt-6">
                    {section.questions?.map((faq, faqIndex) => (
                      <div key={faqIndex}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          {faq.question}
                        </h3>
                        <div className="text-gray-600 leading-relaxed">
                          {renderAnswer(faq.answer)}
                        </div>
                        {faqIndex < section.questions.length - 1 && (
                          <hr className="mt-6 border-gray-200" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="mt-12 bg-teal-50 border-teal-200">
          <CardContent className="text-center py-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {ctaContent.title}
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              {ctaContent.description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <a href={`mailto:${contactInfo.email}`}>
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto">
                  Email Us
                </Button>
              </a>
              <a 
                href={`https://wa.me/${contactInfo.whatsapp?.replace(/\\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-teal-600 text-teal-600 hover:bg-teal-50 w-full sm:w-auto"
                >
                  WhatsApp Us
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FAQsPage;