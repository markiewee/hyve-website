import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const NATIONALITY_FLAGS = {
  // Southeast Asia
  'Singaporean': '\u{1F1F8}\u{1F1EC}',
  'Singapore': '\u{1F1F8}\u{1F1EC}',
  'Malaysian': '\u{1F1F2}\u{1F1FE}',
  'Malaysia': '\u{1F1F2}\u{1F1FE}',
  'Indonesian': '\u{1F1EE}\u{1F1E9}',
  'Indonesia': '\u{1F1EE}\u{1F1E9}',
  'Filipino': '\u{1F1F5}\u{1F1ED}',
  'Filipina': '\u{1F1F5}\u{1F1ED}',
  'Philippines': '\u{1F1F5}\u{1F1ED}',
  'Vietnamese': '\u{1F1FB}\u{1F1F3}',
  'Vietnam': '\u{1F1FB}\u{1F1F3}',
  'Thai': '\u{1F1F9}\u{1F1ED}',
  'Thailand': '\u{1F1F9}\u{1F1ED}',
  'Myanmar': '\u{1F1F2}\u{1F1F2}',
  'Burmese': '\u{1F1F2}\u{1F1F2}',
  'Cambodian': '\u{1F1F0}\u{1F1ED}',
  'Cambodia': '\u{1F1F0}\u{1F1ED}',
  'Laotian': '\u{1F1F1}\u{1F1E6}',
  'Laos': '\u{1F1F1}\u{1F1E6}',
  'Bruneian': '\u{1F1E7}\u{1F1F3}',
  'Brunei': '\u{1F1E7}\u{1F1F3}',
  // South Asia
  'Indian': '\u{1F1EE}\u{1F1F3}',
  'India': '\u{1F1EE}\u{1F1F3}',
  'Sri Lankan': '\u{1F1F1}\u{1F1F0}',
  'Sri Lanka': '\u{1F1F1}\u{1F1F0}',
  'Bangladeshi': '\u{1F1E7}\u{1F1E9}',
  'Bangladesh': '\u{1F1E7}\u{1F1E9}',
  'Pakistani': '\u{1F1F5}\u{1F1F0}',
  'Pakistan': '\u{1F1F5}\u{1F1F0}',
  'Nepalese': '\u{1F1F3}\u{1F1F5}',
  'Nepal': '\u{1F1F3}\u{1F1F5}',
  // East Asia
  'Chinese': '\u{1F1E8}\u{1F1F3}',
  'China': '\u{1F1E8}\u{1F1F3}',
  'Japanese': '\u{1F1EF}\u{1F1F5}',
  'Japan': '\u{1F1EF}\u{1F1F5}',
  'Korean': '\u{1F1F0}\u{1F1F7}',
  'South Korean': '\u{1F1F0}\u{1F1F7}',
  'South Korea': '\u{1F1F0}\u{1F1F7}',
  'Taiwanese': '\u{1F1F9}\u{1F1FC}',
  'Taiwan': '\u{1F1F9}\u{1F1FC}',
  'Hong Konger': '\u{1F1ED}\u{1F1F0}',
  'Hong Kong': '\u{1F1ED}\u{1F1F0}',
  // Europe
  'British': '\u{1F1EC}\u{1F1E7}',
  'United Kingdom': '\u{1F1EC}\u{1F1E7}',
  'French': '\u{1F1EB}\u{1F1F7}',
  'France': '\u{1F1EB}\u{1F1F7}',
  'German': '\u{1F1E9}\u{1F1EA}',
  'Germany': '\u{1F1E9}\u{1F1EA}',
  'Dutch': '\u{1F1F3}\u{1F1F1}',
  'Netherlands': '\u{1F1F3}\u{1F1F1}',
  'Italian': '\u{1F1EE}\u{1F1F9}',
  'Italy': '\u{1F1EE}\u{1F1F9}',
  'Spanish': '\u{1F1EA}\u{1F1F8}',
  'Spain': '\u{1F1EA}\u{1F1F8}',
  'Swedish': '\u{1F1F8}\u{1F1EA}',
  'Sweden': '\u{1F1F8}\u{1F1EA}',
  'Norwegian': '\u{1F1F3}\u{1F1F4}',
  'Norway': '\u{1F1F3}\u{1F1F4}',
  'Danish': '\u{1F1E9}\u{1F1F0}',
  'Denmark': '\u{1F1E9}\u{1F1F0}',
  'Finnish': '\u{1F1EB}\u{1F1EE}',
  'Finland': '\u{1F1EB}\u{1F1EE}',
  'Swiss': '\u{1F1E8}\u{1F1ED}',
  'Switzerland': '\u{1F1E8}\u{1F1ED}',
  'Portuguese': '\u{1F1F5}\u{1F1F9}',
  'Portugal': '\u{1F1F5}\u{1F1F9}',
  'Irish': '\u{1F1EE}\u{1F1EA}',
  'Ireland': '\u{1F1EE}\u{1F1EA}',
  'Austrian': '\u{1F1E6}\u{1F1F9}',
  'Austria': '\u{1F1E6}\u{1F1F9}',
  'Belgian': '\u{1F1E7}\u{1F1EA}',
  'Belgium': '\u{1F1E7}\u{1F1EA}',
  'Polish': '\u{1F1F5}\u{1F1F1}',
  'Poland': '\u{1F1F5}\u{1F1F1}',
  'Czech': '\u{1F1E8}\u{1F1FF}',
  'Czechia': '\u{1F1E8}\u{1F1FF}',
  'Greek': '\u{1F1EC}\u{1F1F7}',
  'Greece': '\u{1F1EC}\u{1F1F7}',
  'Romanian': '\u{1F1F7}\u{1F1F4}',
  'Romania': '\u{1F1F7}\u{1F1F4}',
  'Hungarian': '\u{1F1ED}\u{1F1FA}',
  'Hungary': '\u{1F1ED}\u{1F1FA}',
  'Russian': '\u{1F1F7}\u{1F1FA}',
  'Russia': '\u{1F1F7}\u{1F1FA}',
  'Ukrainian': '\u{1F1FA}\u{1F1E6}',
  'Ukraine': '\u{1F1FA}\u{1F1E6}',
  // Americas
  'American': '\u{1F1FA}\u{1F1F8}',
  'United States': '\u{1F1FA}\u{1F1F8}',
  'Canadian': '\u{1F1E8}\u{1F1E6}',
  'Canada': '\u{1F1E8}\u{1F1E6}',
  'Brazilian': '\u{1F1E7}\u{1F1F7}',
  'Brazil': '\u{1F1E7}\u{1F1F7}',
  'Mexican': '\u{1F1F2}\u{1F1FD}',
  'Mexico': '\u{1F1F2}\u{1F1FD}',
  'Argentinian': '\u{1F1E6}\u{1F1F7}',
  'Argentina': '\u{1F1E6}\u{1F1F7}',
  'Colombian': '\u{1F1E8}\u{1F1F4}',
  'Colombia': '\u{1F1E8}\u{1F1F4}',
  // Oceania
  'Australian': '\u{1F1E6}\u{1F1FA}',
  'Australia': '\u{1F1E6}\u{1F1FA}',
  'New Zealander': '\u{1F1F3}\u{1F1FF}',
  'New Zealand': '\u{1F1F3}\u{1F1FF}',
  // Middle East / Central Asia
  'Turkish': '\u{1F1F9}\u{1F1F7}',
  'Turkey': '\u{1F1F9}\u{1F1F7}',
  'Emirati': '\u{1F1E6}\u{1F1EA}',
  'UAE': '\u{1F1E6}\u{1F1EA}',
  'Saudi': '\u{1F1F8}\u{1F1E6}',
  'Saudi Arabia': '\u{1F1F8}\u{1F1E6}',
  'Israeli': '\u{1F1EE}\u{1F1F1}',
  'Israel': '\u{1F1EE}\u{1F1F1}',
  // Africa
  'South African': '\u{1F1FF}\u{1F1E6}',
  'South Africa': '\u{1F1FF}\u{1F1E6}',
  'Nigerian': '\u{1F1F3}\u{1F1EC}',
  'Nigeria': '\u{1F1F3}\u{1F1EC}',
  'Kenyan': '\u{1F1F0}\u{1F1EA}',
  'Kenya': '\u{1F1F0}\u{1F1EA}',
  'Egyptian': '\u{1F1EA}\u{1F1EC}',
  'Egypt': '\u{1F1EA}\u{1F1EC}',
  'Moroccan': '\u{1F1F2}\u{1F1E6}',
  'Morocco': '\u{1F1F2}\u{1F1E6}',
};

function getFlag(nationality) {
  if (!nationality) return '\u{1F30D}'; // globe
  // Try exact match first, then case-insensitive
  if (NATIONALITY_FLAGS[nationality]) return NATIONALITY_FLAGS[nationality];
  const lower = nationality.toLowerCase();
  for (const [key, flag] of Object.entries(NATIONALITY_FLAGS)) {
    if (key.toLowerCase() === lower) return flag;
  }
  return '\u{1F30D}';
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const HousematePreview = ({ propertyId }) => {
  const [housemates, setHousemates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    const fetchHousemates = async () => {
      try {
        const { data, error } = await supabase
          .from('tenant_profiles')
          .select('id, tenant_details(nationality, date_of_birth)')
          .eq('property_id', propertyId)
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching housemates:', error);
          setLoading(false);
          return;
        }

        const formatted = (data || [])
          .filter(t => t.tenant_details)
          .map(t => {
            const td = t.tenant_details;
            return {
              id: t.id,
              flag: getFlag(td.nationality),
              age: calculateAge(td.date_of_birth),
              nationality: td.nationality,
            };
          })
          .filter(h => h.age); // Only show if we have age

        setHousemates(formatted);
      } catch (err) {
        console.error('Error fetching housemates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHousemates();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="animate-pulse flex gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-16 h-16 rounded-full bg-slate-200" />
        ))}
      </div>
    );
  }

  if (housemates.length === 0) return null;

  return (
    <div>
      <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] mb-2">
        Who you&apos;ll be living with
      </h3>
      <p className="text-sm text-[#6B7280] font-['Manrope'] mb-6">
        Meet your future housemates at this property
      </p>
      <div className="flex flex-wrap gap-3">
        {housemates.map((h) => (
          <div
            key={h.id}
            className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl border border-[rgba(187,202,198,0.15)] hover:border-[#A87813]/30 transition-colors"
          >
            <span className="text-2xl leading-none">{h.flag}</span>
            <span className="font-['Inter'] text-sm font-semibold text-[#1F2937]">{h.age}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#6B7280] font-['Inter'] mt-3">
        {housemates.length} current {housemates.length === 1 ? 'resident' : 'residents'}
      </p>
    </div>
  );
};

export default HousematePreview;
