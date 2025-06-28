import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const FAQsPage = () => {
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const faqSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      questions: [
        {
          question: 'What exactly is coliving?',
          answer: 'Coliving is a modern approach to shared living where you get your own private room in a fully furnished apartment, while sharing common areas like the kitchen, living room, and sometimes bathrooms with other residents. It\'s designed to foster genuine community connections while maintaining your personal space and privacy. Think of it as having built-in friends and a support network from day one.'
        },
        {
          question: 'Who is coliving suitable for?',
          answer: 'Our coliving spaces are perfect for young professionals, digital nomads, students, expatriates, and anyone looking for an affordable, flexible living arrangement in the city. Whether you\'re new to the area, working remotely and craving social connection, or simply want to be part of a vibrant, diverse community where networking and friendships happen naturally, coliving could be ideal for you.'
        },
        {
          question: 'How is coliving different from traditional roommate situations?',
          answer: 'Unlike typical roommate arrangements, coliving comes with professional management, regular cleaning services, all utilities included, and carefully curated community members. We handle all the administrative tasks, maintenance, and ensure community standards are maintained. Most importantly, we focus on building connections - you\'re not just sharing space, you\'re joining a community of like-minded individuals who support each other personally and professionally.'
        }
      ]
    },
    {
      id: 'booking-rental',
      title: 'Booking & Rental Terms',
      questions: [
        {
          question: 'What\'s the minimum rental period?',
          answer: 'We offer flexible lease terms starting from 3 months, perfect for short-term stays, internships, or project-based work. For those looking to settle in longer-term, we also offer 6-month and 12-month options with better rates.'
        },
        {
          question: 'What\'s included in the rent?',
          answer: 'Your rent covers everything: fully furnished private room, access to all common areas, high-speed Wi-Fi, utilities (electricity, water, gas), weekly housekeeping of common areas, maintenance support, and 24/7 community management.'
        },
        {
          question: 'Do I need to pay a security deposit?',
          answer: 'Yes, we require a refundable security deposit equivalent to one month\'s rent. This covers any potential damages and is returned within 14 days of move-out, subject to a final inspection.'
        },
        {
          question: 'Are there any additional fees?',
          answer: 'Apart from rent and deposit, there\'s a one-time admin fee of $200 that covers background checks, contract processing, and welcome package. No hidden costs or surprise charges.'
        }
      ]
    },
    {
      id: 'living-experience',
      title: 'Living Experience',
      questions: [
        {
          question: 'What amenities are provided in the rooms?',
          answer: 'Each private room comes with a comfortable bed, wardrobe, desk and chair, bedside table, and personal lighting. All linens and basic furnishing are included, so you can move in with just your suitcase.'
        },
        {
          question: 'What about common areas?',
          answer: 'Our common areas include a fully equipped kitchen with appliances and cookware, comfortable living spaces designed for both relaxation and collaboration, dining areas perfect for community meals, and in many locations, additional perks like rooftop access, co-working spaces, or fitness areas. These spaces are intentionally designed to encourage interaction and community building.'
        },
        {
          question: 'How do you handle cleaning and maintenance?',
          answer: 'We provide weekly professional cleaning of all common areas. For your private room, basic cleaning supplies are provided, but personal room cleaning is your responsibility. Maintenance requests can be submitted through our app and are typically handled within 24-48 hours.'
        },
        {
          question: 'Is there parking available?',
          answer: 'Parking availability varies by location. Some of our properties offer limited parking spaces for an additional monthly fee, while others are located in areas with excellent public transport connections. We\'ll let you know the parking situation for your specific location.'
        }
      ]
    },
    {
      id: 'community-rules',
      title: 'Community & House Rules',
      questions: [
        {
          question: 'How do you select housemates?',
          answer: 'We have a careful vetting process that includes background checks, employment verification, and sometimes brief interviews to understand lifestyle preferences and community values. We aim to create diverse, respectful communities of like-minded individuals who value both personal space and meaningful connections. Our goal is to match people who will genuinely enjoy living together and can support each other\'s personal and professional growth.'
        },
        {
          question: 'What are the house rules?',
          answer: 'Basic rules include keeping common areas clean, being respectful of noise levels (especially after 10 PM), no smoking indoors, no parties without prior approval, and treating the space and fellow residents with respect. Full house rules are provided before move-in.'
        },
        {
          question: 'Can I have guests over?',
          answer: 'Overnight guests are allowed with prior notice to housemates, but generally limited to 2-3 nights per week to respect everyone\'s comfort. Day guests are welcome in common areas with consideration for others.'
        },
        {
          question: 'What if there are conflicts between housemates?',
          answer: 'Our community managers are trained to mediate conflicts and maintain house harmony. We encourage open communication and provide channels for addressing concerns. In serious cases, we may need to relocate residents to ensure everyone\'s comfort.'
        }
      ]
    },
    {
      id: 'practical-info',
      title: 'Practical Information',
      questions: [
        {
          question: 'How do I apply and what\'s the process?',
          answer: 'You can apply through our website or schedule a viewing. The process includes: application submission, background check, deposit payment, lease signing, and move-in coordination. The entire process typically takes 3-5 business days.'
        },
        {
          question: 'Can I view the room before committing?',
          answer: 'Absolutely! We encourage viewings and offer both in-person tours and virtual walkthroughs. You can also meet potential housemates during your visit to get a feel for the community vibe and see if it\'s a good personality fit. We believe chemistry matters, and we want you to feel confident that you\'ll thrive in our community environment.'
        },
        {
          question: 'What happens if I need to move out early?',
          answer: 'With proper 30-day notice, early termination is possible but may involve an early termination fee. We understand that plans change and try to be as flexible as possible while maintaining house stability.'
        },
        {
          question: 'Do you provide any community events or activities?',
          answer: 'Yes! We organize monthly community events like potluck dinners, game nights, cultural exchanges, professional networking sessions, skill-sharing workshops, and seasonal celebrations. We also facilitate smaller organic gatherings - movie nights, cooking sessions, or weekend adventures. Participation is optional but highly encouraged as it\'s how our strongest community bonds and lasting friendships are formed. Many residents also organize their own events, creating a truly resident-driven community experience.'
        },
        {
          question: 'What locations do you have available?',
          answer: 'We have properties in prime neighborhoods across the city, each chosen for their proximity to public transport, dining, entertainment, and business districts. Current locations include downtown areas, cultural districts, and upcoming neighborhoods with great connectivity.'
        },
        {
          question: 'How do I get help if I have issues?',
          answer: 'Our community management team is available through multiple channels: in-app messaging, WhatsApp, email, and phone. For emergencies, we have 24/7 support. For non-urgent matters, we typically respond within a few hours during business days.'
        }
      ]
    }
  ];

  const FAQItem = ({ question, answer, itemId }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="border-b border-gray-200 last:border-b-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left py-4 px-6 hover:bg-gray-50 transition-colors flex justify-between items-center"
        >
          <h3 className="font-medium text-gray-900 pr-4">{question}</h3>
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
          )}
        </button>
        {isOpen && (
          <div className="px-6 pb-4">
            <p className="text-gray-600 leading-relaxed">{answer}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-600">
            Everything you need to know about joining our coliving community
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          {faqSections.map((section) => (
            <Card key={section.id} className="overflow-hidden">
              <CardHeader className="bg-teal-50">
                <CardTitle className="text-xl text-teal-800">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {section.questions.map((faq, index) => (
                  <FAQItem
                    key={`${section.id}-${index}`}
                    question={faq.question}
                    answer={faq.answer}
                    itemId={`${section.id}-${index}`}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center bg-white rounded-lg p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h2>
          <p className="text-gray-600 mb-6">
            Don't hesitate to reach out to our community team - we're here to help make your coliving experience amazing and ensure you find your perfect community fit!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button className="bg-teal-600 hover:bg-teal-700">
                Contact Our Team
              </Button>
            </Link>
            <Link to="/properties">
              <Button variant="outline">
                View Properties
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQsPage;