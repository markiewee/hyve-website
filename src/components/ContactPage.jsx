import { useState } from 'react';
import { Phone, Mail, MapPin, MessageCircle, Clock, Send, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    preferredContact: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  const contactMethods = [
    {
      icon: Phone,
      title: 'Phone',
      description: 'Call us for immediate assistance',
      value: '+65 6123 4567',
      action: 'Call Now'
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp',
      description: 'Quick responses via WhatsApp',
      value: '+65 9123 4567',
      action: 'Message Us'
    },
    {
      icon: Mail,
      title: 'Email',
      description: 'Send us a detailed message',
      value: 'hello@hyve.sg',
      action: 'Send Email'
    },
    {
      icon: MapPin,
      title: 'Office',
      description: 'Visit our office in person',
      value: '123 Orchard Road, Singapore 238872',
      action: 'Get Directions'
    }
  ];

  const officeHours = [
    { day: 'Monday - Friday', hours: '9:00 AM - 7:00 PM' },
    { day: 'Saturday', hours: '10:00 AM - 5:00 PM' },
    { day: 'Sunday', hours: '12:00 PM - 5:00 PM' }
  ];

  const faqs = [
    {
      question: 'How do I schedule a property viewing?',
      answer: 'You can schedule a viewing through our website, WhatsApp, or by calling us directly. We offer both in-person and virtual tours.'
    },
    {
      question: 'What is included in the monthly rent?',
      answer: 'All our properties include utilities, WiFi, housekeeping, maintenance, and access to common areas. Some properties also include parking.'
    },
    {
      question: 'What is the minimum lease term?',
      answer: 'We offer flexible lease terms starting from 3 months, with options for longer-term stays at discounted rates.'
    },
    {
      question: 'Do you require a security deposit?',
      answer: 'Most of our properties require no security deposit. For premium properties, a refundable deposit equivalent to one month\'s rent may be required.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Get in Touch</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Have questions about our coliving spaces? We're here to help you find your perfect home in Singapore.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Send us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you within 24 hours
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {isSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-600">
                      Thank you for your message. We'll get back to you within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name *
                        </label>
                        <Input
                          required
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address *
                        </label>
                        <Input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="your.email@example.com"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="+65 1234 5678"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subject *
                        </label>
                        <Select value={formData.subject} onValueChange={(value) => handleInputChange('subject', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subject" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewing">Schedule a Viewing</SelectItem>
                            <SelectItem value="availability">Check Availability</SelectItem>
                            <SelectItem value="pricing">Pricing Information</SelectItem>
                            <SelectItem value="application">Rental Application</SelectItem>
                            <SelectItem value="support">General Support</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Contact Method
                      </label>
                      <Select value={formData.preferredContact} onValueChange={(value) => handleInputChange('preferredContact', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="How would you like us to contact you?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Message *
                      </label>
                      <Textarea
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        placeholder="Tell us about your requirements, preferred location, budget, move-in date, or any questions you have..."
                      />
                    </div>
                    
                    <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700">
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            {/* Contact Methods */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Multiple ways to reach us
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {contactMethods.map((method, index) => {
                  const Icon = method.icon;
                  return (
                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{method.title}</h4>
                        <p className="text-sm text-gray-600 mb-1">{method.description}</p>
                        <p className="text-sm font-medium text-gray-900 mb-2">{method.value}</p>
                        <Button size="sm" variant="outline" className="text-xs">
                          {method.action}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Office Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  <span>Office Hours</span>
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {officeHours.map((schedule, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-gray-600">{schedule.day}</span>
                      <span className="font-medium">{schedule.hours}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-teal-50 rounded-lg">
                  <p className="text-sm text-teal-700">
                    <strong>Emergency Support:</strong> Available 24/7 for current residents
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <a href="https://wa.me/6580885410?text=I%20would%20love%20to%20join%20the%20hyve%20community" target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-teal-600 hover:bg-teal-700">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp Us Now
                  </Button>
                </a>
                <Button variant="outline" className="w-full">
                  <Phone className="w-4 h-4 mr-2" />
                  Schedule a Call
                </Button>
                <Button variant="outline" className="w-full">
                  <MapPin className="w-4 h-4 mr-2" />
                  Book Office Visit
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Frequently Asked Questions</CardTitle>
              <CardDescription className="text-center">
                Quick answers to common questions
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {faqs.map((faq, index) => (
                  <div key={index} className="space-y-2">
                    <h4 className="font-semibold text-gray-900">{faq.question}</h4>
                    <p className="text-gray-600 text-sm">{faq.answer}</p>
                  </div>
                ))}
              </div>
              
              <div className="text-center mt-8">
                <p className="text-gray-600 mb-4">
                  Can't find what you're looking for?
                </p>
                <Link to="/faqs">
                  <Button variant="outline">
                    View All FAQs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;

