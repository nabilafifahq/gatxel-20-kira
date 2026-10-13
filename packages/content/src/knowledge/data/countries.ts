/**
 * Negara anggota PBB (192) untuk topik Flags dan Capital cities. Kode `iso` sama dengan nama berkas di
 * apps/web/public/flags/4x3 (paket flag-icons, MIT). `capital` null bila ibu kota punya dua atau lebih
 * versi (misalnya Bolivia, Afrika Selatan) atau belum jelas; negara itu tetap muncul di soal bendera.
 * Israel dan Vatikan sengaja tidak dimasukkan: statusnya atau ibu kotanya diperdebatkan, jadi tutor
 * yang memutuskan kalau mau menambahkannya.
 */

export const CONTINENTS = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania'] as const
export type Continent = (typeof CONTINENTS)[number]

export type Country = { iso: string; name: string; capital: string | null; continent: Continent; tier: 1 | 2 | 3 }

type Row = [iso: string, name: string, capital: string | null]

const ASIA: Row[] = [
  ['af', 'Afghanistan', 'Kabul'],
  ['am', 'Armenia', 'Yerevan'],
  ['az', 'Azerbaijan', 'Baku'],
  ['bh', 'Bahrain', 'Manama'],
  ['bd', 'Bangladesh', 'Dhaka'],
  ['bt', 'Bhutan', 'Thimphu'],
  ['bn', 'Brunei', 'Bandar Seri Begawan'],
  ['kh', 'Cambodia', 'Phnom Penh'],
  ['cn', 'China', 'Beijing'],
  ['ge', 'Georgia', 'Tbilisi'],
  ['in', 'India', 'New Delhi'],
  ['id', 'Indonesia', 'Jakarta'],
  ['ir', 'Iran', 'Tehran'],
  ['iq', 'Iraq', 'Baghdad'],
  ['jp', 'Japan', 'Tokyo'],
  ['jo', 'Jordan', 'Amman'],
  ['kz', 'Kazakhstan', 'Astana'],
  ['kw', 'Kuwait', 'Kuwait City'],
  ['kg', 'Kyrgyzstan', 'Bishkek'],
  ['la', 'Laos', 'Vientiane'],
  ['lb', 'Lebanon', 'Beirut'],
  ['my', 'Malaysia', 'Kuala Lumpur'],
  ['mv', 'Maldives', 'Male'],
  ['mn', 'Mongolia', 'Ulaanbaatar'],
  ['mm', 'Myanmar', 'Naypyidaw'],
  ['np', 'Nepal', 'Kathmandu'],
  ['kp', 'North Korea', 'Pyongyang'],
  ['om', 'Oman', 'Muscat'],
  ['pk', 'Pakistan', 'Islamabad'],
  ['ph', 'Philippines', 'Manila'],
  ['qa', 'Qatar', 'Doha'],
  ['sa', 'Saudi Arabia', 'Riyadh'],
  ['sg', 'Singapore', 'Singapore'],
  ['kr', 'South Korea', 'Seoul'],
  ['lk', 'Sri Lanka', null],
  ['sy', 'Syria', 'Damascus'],
  ['tj', 'Tajikistan', 'Dushanbe'],
  ['th', 'Thailand', 'Bangkok'],
  ['tl', 'Timor-Leste', 'Dili'],
  ['tr', 'Turkey', 'Ankara'],
  ['tm', 'Turkmenistan', 'Ashgabat'],
  ['ae', 'United Arab Emirates', 'Abu Dhabi'],
  ['uz', 'Uzbekistan', 'Tashkent'],
  ['vn', 'Vietnam', 'Hanoi'],
  ['ye', 'Yemen', "Sana'a"],
]

const EUROPE: Row[] = [
  ['al', 'Albania', 'Tirana'],
  ['ad', 'Andorra', 'Andorra la Vella'],
  ['at', 'Austria', 'Vienna'],
  ['by', 'Belarus', 'Minsk'],
  ['be', 'Belgium', 'Brussels'],
  ['ba', 'Bosnia and Herzegovina', 'Sarajevo'],
  ['bg', 'Bulgaria', 'Sofia'],
  ['hr', 'Croatia', 'Zagreb'],
  ['cy', 'Cyprus', 'Nicosia'],
  ['cz', 'Czechia', 'Prague'],
  ['dk', 'Denmark', 'Copenhagen'],
  ['ee', 'Estonia', 'Tallinn'],
  ['fi', 'Finland', 'Helsinki'],
  ['fr', 'France', 'Paris'],
  ['de', 'Germany', 'Berlin'],
  ['gr', 'Greece', 'Athens'],
  ['hu', 'Hungary', 'Budapest'],
  ['is', 'Iceland', 'Reykjavik'],
  ['ie', 'Ireland', 'Dublin'],
  ['it', 'Italy', 'Rome'],
  ['lv', 'Latvia', 'Riga'],
  ['li', 'Liechtenstein', 'Vaduz'],
  ['lt', 'Lithuania', 'Vilnius'],
  ['lu', 'Luxembourg', 'Luxembourg'],
  ['mt', 'Malta', 'Valletta'],
  ['md', 'Moldova', 'Chisinau'],
  ['mc', 'Monaco', 'Monaco'],
  ['me', 'Montenegro', 'Podgorica'],
  ['nl', 'Netherlands', 'Amsterdam'],
  ['mk', 'North Macedonia', 'Skopje'],
  ['no', 'Norway', 'Oslo'],
  ['pl', 'Poland', 'Warsaw'],
  ['pt', 'Portugal', 'Lisbon'],
  ['ro', 'Romania', 'Bucharest'],
  ['ru', 'Russia', 'Moscow'],
  ['sm', 'San Marino', 'San Marino'],
  ['rs', 'Serbia', 'Belgrade'],
  ['sk', 'Slovakia', 'Bratislava'],
  ['si', 'Slovenia', 'Ljubljana'],
  ['es', 'Spain', 'Madrid'],
  ['se', 'Sweden', 'Stockholm'],
  ['ch', 'Switzerland', 'Bern'],
  ['ua', 'Ukraine', 'Kyiv'],
  ['gb', 'United Kingdom', 'London'],
]

const AFRICA: Row[] = [
  ['dz', 'Algeria', 'Algiers'],
  ['ao', 'Angola', 'Luanda'],
  ['bj', 'Benin', null],
  ['bw', 'Botswana', 'Gaborone'],
  ['bf', 'Burkina Faso', 'Ouagadougou'],
  ['bi', 'Burundi', null],
  ['cv', 'Cabo Verde', 'Praia'],
  ['cm', 'Cameroon', 'Yaounde'],
  ['cf', 'Central African Republic', 'Bangui'],
  ['td', 'Chad', "N'Djamena"],
  ['km', 'Comoros', 'Moroni'],
  ['cg', 'Republic of the Congo', 'Brazzaville'],
  ['cd', 'DR Congo', 'Kinshasa'],
  ['ci', "Cote d'Ivoire", null],
  ['dj', 'Djibouti', 'Djibouti'],
  ['eg', 'Egypt', 'Cairo'],
  ['gq', 'Equatorial Guinea', null],
  ['er', 'Eritrea', 'Asmara'],
  ['sz', 'Eswatini', null],
  ['et', 'Ethiopia', 'Addis Ababa'],
  ['ga', 'Gabon', 'Libreville'],
  ['gm', 'Gambia', 'Banjul'],
  ['gh', 'Ghana', 'Accra'],
  ['gn', 'Guinea', 'Conakry'],
  ['gw', 'Guinea-Bissau', 'Bissau'],
  ['ke', 'Kenya', 'Nairobi'],
  ['ls', 'Lesotho', 'Maseru'],
  ['lr', 'Liberia', 'Monrovia'],
  ['ly', 'Libya', 'Tripoli'],
  ['mg', 'Madagascar', 'Antananarivo'],
  ['mw', 'Malawi', 'Lilongwe'],
  ['ml', 'Mali', 'Bamako'],
  ['mr', 'Mauritania', 'Nouakchott'],
  ['mu', 'Mauritius', 'Port Louis'],
  ['ma', 'Morocco', 'Rabat'],
  ['mz', 'Mozambique', 'Maputo'],
  ['na', 'Namibia', 'Windhoek'],
  ['ne', 'Niger', 'Niamey'],
  ['ng', 'Nigeria', 'Abuja'],
  ['rw', 'Rwanda', 'Kigali'],
  ['st', 'Sao Tome and Principe', 'Sao Tome'],
  ['sn', 'Senegal', 'Dakar'],
  ['sc', 'Seychelles', 'Victoria'],
  ['sl', 'Sierra Leone', 'Freetown'],
  ['so', 'Somalia', 'Mogadishu'],
  ['za', 'South Africa', null],
  ['ss', 'South Sudan', 'Juba'],
  ['sd', 'Sudan', 'Khartoum'],
  ['tz', 'Tanzania', 'Dodoma'],
  ['tg', 'Togo', 'Lome'],
  ['tn', 'Tunisia', 'Tunis'],
  ['ug', 'Uganda', 'Kampala'],
  ['zm', 'Zambia', 'Lusaka'],
  ['zw', 'Zimbabwe', 'Harare'],
]

const NORTH_AMERICA: Row[] = [
  ['ag', 'Antigua and Barbuda', "Saint John's"],
  ['bs', 'Bahamas', 'Nassau'],
  ['bb', 'Barbados', 'Bridgetown'],
  ['bz', 'Belize', 'Belmopan'],
  ['ca', 'Canada', 'Ottawa'],
  ['cr', 'Costa Rica', 'San Jose'],
  ['cu', 'Cuba', 'Havana'],
  ['dm', 'Dominica', 'Roseau'],
  ['do', 'Dominican Republic', 'Santo Domingo'],
  ['sv', 'El Salvador', 'San Salvador'],
  ['gd', 'Grenada', "Saint George's"],
  ['gt', 'Guatemala', 'Guatemala City'],
  ['ht', 'Haiti', 'Port-au-Prince'],
  ['hn', 'Honduras', 'Tegucigalpa'],
  ['jm', 'Jamaica', 'Kingston'],
  ['mx', 'Mexico', 'Mexico City'],
  ['ni', 'Nicaragua', 'Managua'],
  ['pa', 'Panama', 'Panama City'],
  ['kn', 'Saint Kitts and Nevis', 'Basseterre'],
  ['lc', 'Saint Lucia', 'Castries'],
  ['vc', 'Saint Vincent and the Grenadines', 'Kingstown'],
  ['tt', 'Trinidad and Tobago', 'Port of Spain'],
  ['us', 'United States', 'Washington, D.C.'],
]

const SOUTH_AMERICA: Row[] = [
  ['ar', 'Argentina', 'Buenos Aires'],
  ['bo', 'Bolivia', null],
  ['br', 'Brazil', 'Brasilia'],
  ['cl', 'Chile', 'Santiago'],
  ['co', 'Colombia', 'Bogota'],
  ['ec', 'Ecuador', 'Quito'],
  ['gy', 'Guyana', 'Georgetown'],
  ['py', 'Paraguay', 'Asuncion'],
  ['pe', 'Peru', 'Lima'],
  ['sr', 'Suriname', 'Paramaribo'],
  ['uy', 'Uruguay', 'Montevideo'],
  ['ve', 'Venezuela', 'Caracas'],
]

const OCEANIA: Row[] = [
  ['au', 'Australia', 'Canberra'],
  ['fj', 'Fiji', 'Suva'],
  ['ki', 'Kiribati', 'Tarawa'],
  ['mh', 'Marshall Islands', 'Majuro'],
  ['fm', 'Micronesia', 'Palikir'],
  ['nr', 'Nauru', null],
  ['nz', 'New Zealand', 'Wellington'],
  ['pw', 'Palau', 'Ngerulmud'],
  ['pg', 'Papua New Guinea', 'Port Moresby'],
  ['ws', 'Samoa', 'Apia'],
  ['sb', 'Solomon Islands', 'Honiara'],
  ['to', 'Tonga', "Nuku'alofa"],
  ['tv', 'Tuvalu', 'Funafuti'],
  ['vu', 'Vanuatu', 'Port Vila'],
]

/** Negara yang paling dikenal anak (soal pertama). */
const TIER1 = new Set(
  'id my sg th ph vn jp cn in kr au nz us gb fr de it es nl br ar ca mx eg za sa tr ru ch se no pt gr kh tl pk bd ke ng ma ir iq'.split(' '),
)
/** Negara yang cukup dikenal (soal berikutnya). */
const TIER2 = new Set(
  'bn la mm np lk mn kp ae qa kw jo lb sy af kz uz ie be at dk fi pl cz hu ro ua hr rs is pe cl co ve cu jm ec bo py uy et gh tz dz tn ly sn cm ci mg ug zw sd mu fj pg bt mv ge am az lu mt cy bg'.split(' '),
)

function make(rows: Row[], continent: Continent): Country[] {
  return rows.map(([iso, name, capital]) => ({ iso, name, capital, continent, tier: TIER1.has(iso) ? 1 : TIER2.has(iso) ? 2 : 3 }))
}

export const COUNTRIES: readonly Country[] = [
  ...make(ASIA, 'Asia'),
  ...make(EUROPE, 'Europe'),
  ...make(AFRICA, 'Africa'),
  ...make(NORTH_AMERICA, 'North America'),
  ...make(SOUTH_AMERICA, 'South America'),
  ...make(OCEANIA, 'Oceania'),
]

export function countryByIso(iso: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso === iso)
}
