import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const TransferOfTenancyPage = () => {
  const questions = [
    {
      question: 'What is a licence transfer?',
      answer: 'A licence transfer is when an existing tenant passes their remaining lease term to a new tenant. Instead of ending the lease early and forfeiting the deposit, the current tenant finds a replacement who takes over the room on the existing terms.'
    },
    {
      question: 'Who handles the transfer?',
      answer: 'The outgoing tenant is responsible for the transfer process — this must be done by the tenant themselves and not delegated to Hyve. This includes: sourcing a suitable replacement, introducing them to Hyve, answering their queries about the room, property, and existing licence, having them review and agree to the Transfer of Tenancy Agreement, coordinating the handover date, and ensuring the room is in good condition for handover. Hyve only handles: issuing the updated licence to the incoming tenant, and processing the deposit refund once the transfer is complete.'
    },
    {
      question: 'Why do I have to find my own replacement?',
      answer: 'Your licence is a binding agreement for a fixed term. By finding a replacement, you\'re avoiding early termination fees and forfeiting your deposit.'
    },
    {
      question: 'What are the terms for the new tenant?',
      answer: 'The incoming tenant inherits the outgoing tenant\'s existing licence — same rent, same deposit, same remaining term, and all associated liabilities. There is no renegotiation of terms at transfer. The new tenant takes on: the remaining lease term (no reset), the same monthly rent and deposit, any existing liabilities tied to the licence (outstanding maintenance obligations, house rules, pending fees), and responsibility for the room from the takeover date. A Transfer of Tenancy Agreement is executed between the outgoing tenant, incoming tenant, and Hyve to formalise the handover.'
    },
    {
      question: 'When do I get my deposit back?',
      answer: 'Your deposit is refunded once the new tenant (1) signs the licence agreement, (2) pays their deposit and first month\'s rent, and (3) officially moves in. Refunds are processed within 7 working days of all three conditions being met.'
    },
    {
      question: 'What gets deducted from my deposit?',
      answer: 'Unpaid rent or utilities up to the takeover date, damage beyond normal wear and tear, missing inventory (furniture, keys, access cards), and cleaning fees if the room requires deep cleaning at handover. A final inspection is done before handover and you\'ll receive an itemised statement if any deductions apply.'
    },
    {
      question: 'What if the new tenant I found chooses a different Hyve unit?',
      answer: 'If your prospect views Hyve properties and chooses a different unit (e.g. a different property or room type), the transfer of your lease has not been completed. Your deposit is not yet refundable under the transfer process, and you\'ll need to continue sourcing a replacement for your original room. However, you\'re still eligible for our $100 SGD referral bonus for bringing them to Hyve — this applies even if they take a different unit.'
    },
    {
      question: 'What if I found someone but they\'re moving in later than my exit date?',
      answer: 'You remain on the hook for the rent until the new tenant\'s takeover date. The licence is still active in your name until the transfer is executed, so unpaid rent during that gap period is your responsibility.'
    },
    {
      question: 'What if I can\'t find a replacement?',
      answer: 'If you cannot find a replacement before your exit date, your deposit is forfeited as per the early termination clause. You remain liable for rent until the room is re-let or until your lease naturally ends, whichever is earlier. Hyve will begin marketing the room through our own channels.'
    },
    {
      question: 'Can I transfer to anyone?',
      answer: 'The incoming tenant must pass Hyve\'s standard screening (employment status, references, ID verification), be willing to commit to at least the remaining term of your lease, agree to Hyve\'s house rules and property-specific policies, and be compatible with existing housemates. Hyve has final approval on any incoming tenant.'
    },
    {
      question: 'How does the referral bonus work?',
      answer: 'If you refer someone who signs a licence with Hyve (for any unit, any property), you receive $100 SGD after they complete their first month. This applies whether or not they take over your specific room.'
    },
    {
      question: 'Can my friend just replace me unofficially?',
      answer: 'No. All transfers must go through Hyve\'s process. Unauthorised subletting is grounds for immediate termination.'
    }
  ];

  const FAQItem = ({ question, answer }) => {
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
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{answer}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/faqs" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to FAQs
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Transfer of Tenancy</h1>
          <p className="text-lg text-gray-600">
            Everything you need to know about passing your Hyve licence to a new tenant.
          </p>
          <p className="text-sm text-gray-400 mt-2">Last updated: 19 Feb 2026</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {questions.map((item, idx) => (
              <FAQItem key={idx} question={item.question} answer={item.answer} />
            ))}
          </CardContent>
        </Card>

        <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-2">Need the Transfer of Tenancy Agreement?</h2>
          <p className="text-gray-600 mb-4">
            Download a sample of the agreement to share with your incoming tenant.
          </p>
          <Button asChild>
            <a href="/docs/transfer-of-tenancy-sample.pdf" target="_blank" rel="noopener noreferrer">
              Download Sample Agreement
            </a>
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          Questions? WhatsApp us or email <a href="mailto:admin@lazybee.sg" className="text-blue-600 hover:underline">admin@lazybee.sg</a>
        </div>
      </div>
    </div>
  );
};

export default TransferOfTenancyPage;
